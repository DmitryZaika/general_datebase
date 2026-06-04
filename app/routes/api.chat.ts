import OpenAI from 'openai'
import type { LoaderFunctionArgs } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import type { InstructionSlim } from '~/types'
import {
  answerHasUsableInfo,
  shouldAttachInstructionLink,
  stripChatResponseMarkersTrimmed,
} from '~/utils/chatAnswerHelpers'
import { DONE_KEY } from '~/utils/constants'
import {
  collectRelatedInstructionImages,
  findBestMatchingInstruction,
} from '~/utils/instructionImages'
import {
  appendSpecialOrderPrompt,
  calculateSpecialOrder,
  formatSpecialOrderResult,
  inferSpecialOrderOfferFromAnswer,
  isPriceRelatedQuery,
  parseSlabsAndDelivery,
  parseSpecialOrderMarker,
  type SpecialOrderOffer,
  shouldRebuildPriceListContext,
  userDeclinedSpecialOrder,
} from '~/utils/specialOrderCalculator'
import { htmlToPlainText } from '~/utils/stringHelpers'
import {
  buildSupplierPriceListContext,
  type PriceListProgress,
  type SupplierSource,
} from '~/utils/supplierChatContext.server'
import { selectMany } from '../utils/queryHelpers'
import { getUserBySessionId } from '../utils/session.server'

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatMode = 'instructions' | 'priceLists'

async function getContext(
  user_id: number,
  query: string,
): Promise<{ messages: Message[]; id: number }> {
  const history = await selectMany<{ history: Message[]; id: number }>(
    db,
    'SELECT id, history from chat_history WHERE user_id = ?',
    [user_id],
  )

  const currentConvo = history[0].history
  currentConvo.push({ role: 'user', content: query })
  return { messages: currentConvo, id: history[0].id }
}

function buildInstructionContext(instructions: InstructionSlim[]): string {
  const entries = instructions.map((instruction, index) => {
    const title = instruction.title?.trim() || `Untitled #${instruction.id}`
    const body = htmlToPlainText(instruction.rich_text).trim() || '(empty)'
    return `Instruction ${index + 1}
TITLE: ${title}
BODY: ${body}`
  })

  return `Here are the instructions you can use, each TITLE is linked to its own BODY:

${entries.join('\n\n')}`
}

const INSTRUCTION_RULES = `How to use this context:
1. Each entry above is one instruction with a clear TITLE and the BODY that belongs to that exact title.
2. When the user asks about a topic, FIRST find the single instruction whose TITLE best matches the topic (for example, a question about the contract must be answered from the "Contract" title's BODY).
3. Answer using ONLY that matching title's BODY. Do not mix in content from other titles unless the user explicitly asks about them.
4. If no title matches the topic, say that you do not have an instruction for it instead of guessing.
5. Be brief and direct. Do NOT copy the instruction text word-for-word. Summarize the main idea in your own words using short paragraphs or bullet points.
6. Include every important fact, step, requirement, and exception from the matching BODY. Do not leave out actionable information, but skip filler and repetition.
7. Do NOT add unnecessary assumptions or commentary beyond what the matching instruction requires.`

const PRICE_LIST_RULES = `How to use this context:
1. You are in Price lists mode. Use ONLY the supplier documents below.
2. These documents come from supplier files on the Suppliers page. They may be PDFs or images.
3. Only state a dollar price if an exact price appears in the documents. Never calculate, estimate, or invent a price.
4. Many supplier documents show color groups or levels instead of prices. When one SOURCE from a supplier lists the product with a group or level and size but no dollar amount, check every other SOURCE from that same supplier for the actual price before answering.
5. Only if no SOURCE from that supplier contains a dollar price should you say the price is not specified and state the level or group and size. Example: "The price is not specified. The level is Group 7. The size is 126x63."
6. When citing a dollar price, use the SOURCE that contains the price, not the color group document.
7. If the requested color name is close but not exact (for example the user asks for "Adonia" and the document lists "Calacatta Adonia"), give the price for the closest matching product from that supplier. Say clearly that the name was not an exact match, give the exact product name from the document, then state the price and slab size. Example: "There is no exact match for \"Adonia\", but Calacatta Adonia is listed at $21.47 per sqft for a 130×79 slab."
8. Only say you could not find the product when there is no reasonable close match in the documents from that supplier.
9. Be brief and direct. Do not guess or use outside knowledge.
10. Each document is labeled with a SOURCE number. After your answer, add a final line containing ONLY the marker in the exact form [[SOURCE:n]] (use a colon, no spaces), where n is the SOURCE number of the document you used. If you could not find the product, use [[SOURCE:none]]. Never describe or mention this marker in your prose.
11. Whenever you state an exact dollar price AND a slab size in inches (whether per sqft, per slab, or other wording), do NOT ask about special orders in your prose. Always add the marker [[SPECIAL_ORDER:price=X,length=Y,width=Z]] on its own line at the end, where X is the price per sqft (convert from slab price if the document lists per slab), Y is length in inches, Z is width in inches. The app adds the special order question automatically. Never describe or mention this marker in your prose.`

const PRICE_LIST_SKILL_MESSAGE =
  'Turn on the Price lists skill using the + button to search supplier price lists.'

async function getCompanyTaxRate(companyId: number): Promise<number> {
  const rows = await selectMany<{ state_taxes: number | string | null }>(
    db,
    'SELECT state_taxes FROM company WHERE id = ?',
    [companyId],
  )
  const raw = rows[0]?.state_taxes
  const rate = typeof raw === 'string' ? Number.parseFloat(raw) : Number(raw)
  return Number.isFinite(rate) && rate >= 0 ? rate : 0
}

function parseSpecialOrderParams(url: URLSearchParams): SpecialOrderOffer | null {
  const pricePerSqft = Number.parseFloat(url.get('specialOrderPrice') ?? '')
  const lengthInches = Number.parseFloat(url.get('specialOrderLength') ?? '')
  const widthInches = Number.parseFloat(url.get('specialOrderWidth') ?? '')
  if (
    !Number.isFinite(pricePerSqft) ||
    !Number.isFinite(lengthInches) ||
    !Number.isFinite(widthInches) ||
    pricePerSqft <= 0 ||
    lengthInches <= 0 ||
    widthInches <= 0
  ) {
    return null
  }
  return { pricePerSqft, lengthInches, widthInches }
}

async function respondWithFixedAnswer(
  send: (payload: { data: string; event?: string }) => void,
  userId: number,
  isNew: boolean,
  query: string,
  answer: string,
) {
  send({ event: 'status', data: JSON.stringify({ state: 'answering' }) })
  await streamTextAnswer(send, answer)
  send({ data: DONE_KEY })

  if (isNew) {
    await insertContext(userId, [{ role: 'user', content: query }], answer)
    return
  }

  const result = await getContext(userId, query)
  await updateContext(userId, result.id, result.messages, answer)
}

async function newInstructionContext(
  company_id: number,
  query: string,
): Promise<{ history: Message[] }> {
  const instructions = await selectMany<InstructionSlim>(
    db,
    'SELECT id, title, rich_text from instructions WHERE company_id = ?',
    [company_id],
  )

  return {
    history: [
      {
        role: 'system',
        content: `${buildInstructionContext(instructions)}\n\n${INSTRUCTION_RULES}`,
      },
      {
        role: 'user',
        content: `Answer the question as best as you can.\n\nQuestion: ${query}\n\nAnswer:`,
      },
    ],
  }
}

function buildPriceListHistory(query: string, context: string): Message[] {
  return [
    {
      role: 'system',
      content: `${context}\n\n${PRICE_LIST_RULES}`,
    },
    {
      role: 'user',
      content: `Answer the question using the supplier price lists.\n\nQuestion: ${query}\n\nAnswer:`,
    },
  ]
}

function withPriceListContext(messages: Message[], context: string): Message[] {
  const priceListMessage: Message = {
    role: 'system',
    content: `${context}\n\n${PRICE_LIST_RULES}`,
  }
  const withoutOldPriceList = messages.filter(
    message =>
      !(
        message.role === 'system' && message.content.startsWith('SUPPLIER PRICE LISTS')
      ),
  )
  const firstSystemIndex = withoutOldPriceList.findIndex(
    message => message.role === 'system',
  )
  if (firstSystemIndex === -1) {
    return [priceListMessage, ...withoutOldPriceList]
  }
  const next = [...withoutOldPriceList]
  next.splice(firstSystemIndex + 1, 0, priceListMessage)
  return next
}

function parseSourceId(answer: string): number | null {
  const match = answer.match(/\[+\s*SOURCE\s*[:#-]?\s*([^\]]*?)\s*\]+/i)
  if (!match) return null
  const id = Number.parseInt(match[1], 10)
  return Number.isNaN(id) ? null : id
}

async function streamTextAnswer(
  send: (payload: { data: string }) => void,
  text: string,
) {
  const chunkSize = 24
  for (let index = 0; index < text.length; index += chunkSize) {
    send({ data: text.slice(index, index + chunkSize) })
  }
}

async function loadInstructionMatchData(
  companyId: number,
  query: string,
): Promise<{
  images: string[]
  instruction: ReturnType<typeof findBestMatchingInstruction>
}> {
  const instructions = await selectMany<InstructionSlim>(
    db,
    'SELECT id, title, rich_text from instructions WHERE company_id = ?',
    [companyId],
  )
  return {
    images: collectRelatedInstructionImages(instructions, query),
    instruction: findBestMatchingInstruction(instructions, query),
  }
}

async function insertContext(user_id: number, messages: Message[], answer: string) {
  messages.push({ role: 'assistant', content: answer })
  await db.execute(`INSERT INTO chat_history (history, user_id) VALUES (?, ?);`, [
    JSON.stringify(messages),
    user_id,
  ])
}

async function updateContext(
  userId: number,
  chatHistoryId: number,
  messages: Message[],
  answer: string,
) {
  messages.push({ role: 'assistant', content: answer })
  await db.execute(
    `UPDATE chat_history SET history = ? WHERE id = ? AND user_id = ?;`,
    [JSON.stringify(messages), chatHistoryId, userId],
  )
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  const url = new URL(request.url).searchParams
  const query = url.get('query') || ''
  const isNew = url.get('isNew') === 'true'
  const mode: ChatMode =
    url.get('mode') === 'priceLists' ? 'priceLists' : 'instructions'

  if (!activeSession) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = (await getUserBySessionId(activeSession)) || null

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const companyId = user.company_id
  const userId = user.id
  const specialOrderOffer = parseSpecialOrderParams(url)

  return eventStream(
    request.signal,
    function setup(send) {
      for (let i = 0; i < 30; i++) {
        send({ event: 'ping', data: '' })
      }

      send({ event: 'info', data: 'Connecting to AI...' })

      ;(async () => {
        let answer = ''

        try {
          let messages: Message[] = []
          let chatHistoryId: number | undefined
          let supplierSources: SupplierSource[] = []
          let skipPriceListRebuild = false

          const emitProgress = (progress: PriceListProgress) => {
            send({ event: 'status', data: JSON.stringify(progress) })
          }

          const taxRate = await getCompanyTaxRate(companyId)

          if (mode === 'instructions' && isPriceRelatedQuery(query)) {
            await respondWithFixedAnswer(
              send,
              userId,
              isNew,
              query,
              PRICE_LIST_SKILL_MESSAGE,
            )
            return
          }

          let messagesPrepared = false

          if (!isNew && specialOrderOffer && mode === 'priceLists') {
            const result = await getContext(userId, query)
            chatHistoryId = result.id
            skipPriceListRebuild = true

            if (userDeclinedSpecialOrder(query)) {
              answer = 'No problem. Let me know if you need anything else.'
              send({ event: 'status', data: JSON.stringify({ state: 'answering' }) })
              await streamTextAnswer(send, answer)
              send({ data: DONE_KEY })
              if (chatHistoryId) {
                updateContext(userId, chatHistoryId, result.messages, answer)
              }
              return
            }

            const { slabs, deliveryCost } = parseSlabsAndDelivery(query)

            if (slabs !== undefined && deliveryCost !== undefined) {
              const input = {
                ...specialOrderOffer,
                slabs,
                deliveryCost,
                taxRate,
              }
              const calcResult = calculateSpecialOrder(input)
              answer = formatSpecialOrderResult(input, calcResult)
              send({ event: 'status', data: JSON.stringify({ state: 'answering' }) })
              await streamTextAnswer(send, answer)
              send({ data: DONE_KEY })
              if (chatHistoryId) {
                updateContext(userId, chatHistoryId, result.messages, answer)
              }
              return
            }

            messages = result.messages
            const historyBeforeQuery = result.messages.slice(0, -1)
            if (
              shouldRebuildPriceListContext(
                historyBeforeQuery,
                query,
                specialOrderOffer,
              )
            ) {
              const priceListData = await buildSupplierPriceListContext(
                companyId,
                query,
                emitProgress,
              )
              messages = withPriceListContext(messages, priceListData.context)
              supplierSources = priceListData.sources
            }
            messagesPrepared = true
          } else if (isNew) {
            const chatHistory = await selectMany<{ id: number }>(
              db,
              'SELECT id from chat_history WHERE user_id = ?',
              [userId],
            )
            if (chatHistory.length > 0) {
              chatHistoryId = chatHistory[0].id
            }

            if (mode === 'priceLists') {
              const priceListData = await buildSupplierPriceListContext(
                companyId,
                query,
                emitProgress,
              )
              messages = buildPriceListHistory(query, priceListData.context)
              supplierSources = priceListData.sources
            } else {
              const result = await newInstructionContext(companyId, query)
              messages = result.history
            }
          } else if (!messagesPrepared) {
            const result = await getContext(userId, query)
            messages = result.messages
            chatHistoryId = result.id
            if (mode === 'priceLists') {
              const historyBeforeQuery = result.messages.slice(0, -1)
              if (
                shouldRebuildPriceListContext(
                  historyBeforeQuery,
                  query,
                  specialOrderOffer,
                )
              ) {
                const priceListData = await buildSupplierPriceListContext(
                  companyId,
                  query,
                  emitProgress,
                )
                messages = withPriceListContext(messages, priceListData.context)
                supplierSources = priceListData.sources
              } else {
                skipPriceListRebuild = true
              }
            }
          }

          const instructionMatch =
            mode === 'instructions'
              ? await loadInstructionMatchData(companyId, query)
              : { images: [] as string[], instruction: null }

          send({ event: 'status', data: JSON.stringify({ state: 'answering' }) })

          const response = await openai.chat.completions.create({
            model: 'gpt-4.1-mini-2025-04-14',
            messages: messages,
            temperature: 0,
            max_tokens: 1024,
            stream: true,
          })

          let pending = ''
          const streamHoldback = 64
          for await (const chunk of response) {
            const message = chunk.choices[0].delta.content
            if (message) {
              answer += message
              pending += message
              if (pending.length > streamHoldback) {
                send({ data: pending.slice(0, pending.length - streamHoldback) })
                pending = pending.slice(pending.length - streamHoldback)
              }
            }
          }
          if (pending) {
            send({ data: pending })
          }

          let cleanAnswer = stripChatResponseMarkersTrimmed(answer)
          const offerFromAnswer =
            parseSpecialOrderMarker(answer) ?? inferSpecialOrderOfferFromAnswer(answer)
          if (offerFromAnswer) {
            cleanAnswer = appendSpecialOrderPrompt(cleanAnswer)
            const strippedAnswer = stripChatResponseMarkersTrimmed(answer)
            const promptTail = cleanAnswer.slice(strippedAnswer.length)
            if (promptTail) {
              send({ data: promptTail })
            }
          }

          const hasInfo = answerHasUsableInfo(cleanAnswer)
          const imagesToSend = mode === 'instructions' ? instructionMatch.images : []

          if (
            hasInfo &&
            mode === 'instructions' &&
            instructionMatch.instruction &&
            shouldAttachInstructionLink(query, isNew)
          ) {
            send({
              event: 'instruction',
              data: JSON.stringify(instructionMatch.instruction),
            })
          }

          if (hasInfo && mode === 'priceLists' && !skipPriceListRebuild) {
            const sourceId = parseSourceId(answer)
            const source =
              sourceId !== null
                ? supplierSources.find(item => item.id === sourceId)
                : undefined
            if (source) {
              send({ event: 'source', data: JSON.stringify(source) })
              if (source.fileType === 'image') {
                send({ event: 'images', data: JSON.stringify([source.url]) })
              }
            }

            if (offerFromAnswer) {
              send({
                event: 'specialOrderOffer',
                data: JSON.stringify(offerFromAnswer),
              })
            }
          }

          if (hasInfo && imagesToSend.length > 0) {
            send({ event: 'images', data: JSON.stringify(imagesToSend) })
          }

          send({ data: DONE_KEY })

          if (chatHistoryId) {
            updateContext(userId, chatHistoryId, messages, cleanAnswer)
          } else {
            insertContext(userId, messages, cleanAnswer)
          }
        } catch (error) {
          send({
            data: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        }
      })()

      return function clear() {
        return undefined
      }
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  )
}
