import OpenAI from 'openai'
import type { LoaderFunctionArgs } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
import { selectMany } from '../utils/queryHelpers'
import { getUserBySessionId } from '../utils/session.server'

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const instructionsCache = new Map<
  number,
  { data: InstructionSlim[]; updatedAt: number }
>()

function compactText(input: string, maxLen: number) {
  const cleaned = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen)
}

function compactMessages(messages: Message[], maxMessages: number) {
  const systemMessages = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')
  const tail = nonSystem.slice(Math.max(0, nonSystem.length - maxMessages))
  const clippedTail = tail.map(m => ({
    role: m.role,
    content: compactText(m.content, 4000),
  }))
  const clippedSystem = systemMessages.slice(0, 1).map(m => ({
    role: m.role,
    content: compactText(m.content, 8000),
  }))
  return [...clippedSystem, ...clippedTail]
}

async function getInstructions(company_id: number): Promise<InstructionSlim[]> {
  const cached = instructionsCache.get(company_id)
  const now = Date.now()
  if (cached && now - cached.updatedAt < 60_000) {
    return cached.data
  }
  const instructions = await selectMany<InstructionSlim>(
    db,
    'SELECT id, title, rich_text from instructions WHERE company_id = ?',
    [company_id],
  )
  const compacted = instructions.map(i => ({
    id: i.id,
    title: i.title,
    rich_text: compactText(i.rich_text || '', 1200),
  }))
  instructionsCache.set(company_id, { data: compacted, updatedAt: now })
  return compacted
}

async function getContext(
  user_id: number,
  query: string,
): Promise<{ messages: Message[]; id: number }> {
  const history = await selectMany<{ history: Message[]; id: number }>(
    db,
    'SELECT id, history from chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [user_id],
  )

  if (history.length === 0) {
    const messages: Message[] = [{ role: 'user', content: query }]
    return { messages, id: 0 }
  }

  const currentConvo = history[0].history
  currentConvo.push({ role: 'user', content: query })
  const compacted = compactMessages(currentConvo, 20)
  return { messages: compacted, id: history[0].id }
}

async function newContext(
  user_id: number,
  company_id: number,
  query: string,
): Promise<{ history: Message[]; id: number | undefined }> {
  const instructions = await getInstructions(company_id)
  const chatHistory = await selectMany<{ id: number }>(
    db,
    'SELECT id from chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [user_id],
  )

  let chatHistoryId: number | undefined
  if (chatHistory.length > 0) {
    chatHistoryId = chatHistory[0].id
  }
  return {
    history: [
      {
        role: 'system',
        content: `Here is your context: ${JSON.stringify(instructions)}.
        Follow ALL instructions strictly without exceptions.
        Your task is to provide the MOST complete and accurate answer to the user's request based ONLY on this context.
        Do NOT add unnecessary information, assumptions, or commentary.
        Return only what is explicitly required by the request and the given instructions.`,
      },
      {
        role: 'user',
        content: `Answer the question as best as you can.\n\nQuestion: ${query}\n\nAnswer:`,
      },
    ],
    id: chatHistoryId,
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

  if (!activeSession) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = (await getUserBySessionId(activeSession)) || null

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let messages: Message[] = []
  let chatHistoryId: number | undefined

  if (isNew) {
    const result = await newContext(user.id, user.company_id, query)
    messages = result.history
    chatHistoryId = result.id
  } else {
    const result = await getContext(user.id, query)
    messages = result.messages
    chatHistoryId = result.id
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: compactMessages(messages, 20),
    stream: true,
  })

  return eventStream(
    request.signal,
    function setup(send) {
      send({ event: 'info', data: 'Connecting to AI...' })
      const heartbeat = setInterval(() => {
        send({ event: 'ping', data: '' })
      }, 15_000)

      ;(async () => {
        let answer = ''

        try {
          for await (const chunk of response) {
            const delta = chunk.choices?.[0]?.delta
            const message = delta?.content

            if (!delta) continue
            if (!message) continue

            send({ data: message })
            answer += message
          }

          send({ data: DONE_KEY })

          if (chatHistoryId) {
            updateContext(user.id, chatHistoryId, messages, answer)
          } else {
            insertContext(user.id, messages, answer)
          }
        } catch (error) {
          send({
            data: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        } finally {
          clearInterval(heartbeat)
        }
      })()

      return function clear() {
        clearInterval(heartbeat)
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
