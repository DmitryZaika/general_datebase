import OpenAI from 'openai'
import type { LoaderFunctionArgs } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { db } from '~/db.server'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
import { getSession } from '../sessions'
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
  instructionsCache.set(company_id, { data: instructions, updatedAt: now })
  return instructions
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
  return { messages: currentConvo, id: history[0].id }
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
        content: `Here is your context: ${JSON.stringify(instructions)}`,
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
    model: "gpt-5-mini",
    messages: messages,
    max_completion_tokens: 1024,
    stream: true,
  })

  return eventStream(
    request.signal,
    function setup(send) {
      send({ event: 'info', data: 'Connecting to AI...' })

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
        }
      })()

      return function clear() {
        // do nothing
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
