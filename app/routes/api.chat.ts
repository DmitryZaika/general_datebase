import OpenAI from 'openai'
import type { LoaderFunctionArgs } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import type { InstructionSlim } from '~/types'
import { answerHasUsableInfo } from '~/utils/chatAnswerHelpers'
import { DONE_KEY } from '~/utils/constants'
import {
  collectRelatedInstructionImages,
  findBestMatchingInstruction,
} from '~/utils/instructionImages'
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
4. Many supplier documents show color groups or levels instead of prices. When a product is listed with a group or level and size but no dollar amount, say clearly that the price is not specified, then state the level or group and the size from the document.
5. Example format when no price is listed: "The price is not specified. The level is Group 7. The size is 126x63."
6. If the product is not in the documents at all, say you could not find it in the supplier price lists.
7. Be brief and direct. Do not guess or use outside knowledge.
8. Each document is labeled with a SOURCE number. After your answer, add a final line containing ONLY the marker in the exact form [[SOURCE:n]] (use a colon, no spaces), where n is the SOURCE number of the document you used. If you could not find the product, use [[SOURCE:none]]. Never describe or mention this marker in your prose.`

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

const SOURCE_MARKER_RE = /\s*\[+\s*SOURCE\s*[:#-]?\s*([^\]]*?)\s*\]+\s*$/i
const SOURCE_HOLDBACK = 48

function parseSourceId(answer: string): number | null {
  const match = answer.match(/\[+\s*SOURCE\s*[:#-]?\s*([^\]]*?)\s*\]+/i)
  if (!match) return null
  const id = Number.parseInt(match[1], 10)
  return Number.isNaN(id) ? null : id
}

function stripSourceMarker(text: string): string {
  return text.replace(SOURCE_MARKER_RE, '')
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
          let supplierImages: string[] = []
          let supplierSources: SupplierSource[] = []

          const emitProgress = (progress: PriceListProgress) => {
            send({ event: 'status', data: JSON.stringify(progress) })
          }

          if (isNew) {
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
              supplierImages = priceListData.imageUrls
              supplierSources = priceListData.sources
            } else {
              const result = await newInstructionContext(companyId, query)
              messages = result.history
            }
          } else {
            const result = await getContext(userId, query)
            messages = result.messages
            chatHistoryId = result.id
            if (mode === 'priceLists') {
              const priceListData = await buildSupplierPriceListContext(
                companyId,
                query,
                emitProgress,
              )
              messages = withPriceListContext(messages, priceListData.context)
              supplierImages = priceListData.imageUrls
              supplierSources = priceListData.sources
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
          for await (const chunk of response) {
            const message = chunk.choices[0].delta.content
            if (message) {
              answer += message
              pending += message
              if (pending.length > SOURCE_HOLDBACK) {
                const flush = pending.slice(0, pending.length - SOURCE_HOLDBACK)
                send({ data: flush })
                pending = pending.slice(pending.length - SOURCE_HOLDBACK)
              }
            }
          }
          const tail = stripSourceMarker(pending)
          if (tail) {
            send({ data: tail })
          }

          const cleanAnswer = stripSourceMarker(answer)
          const hasInfo = answerHasUsableInfo(cleanAnswer)
          const imagesToSend =
            mode === 'priceLists' ? supplierImages : instructionMatch.images

          if (hasInfo && mode === 'instructions' && instructionMatch.instruction) {
            send({
              event: 'instruction',
              data: JSON.stringify(instructionMatch.instruction),
            })
          }

          if (hasInfo && mode === 'priceLists') {
            const sourceId = parseSourceId(answer)
            const source =
              sourceId !== null
                ? supplierSources.find(item => item.id === sourceId)
                : undefined
            if (source) {
              send({ event: 'source', data: JSON.stringify(source) })
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
