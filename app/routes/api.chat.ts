import OpenAI from 'openai'
import type { LoaderFunctionArgs } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
import { selectMany } from '../utils/queryHelpers'
import { getUserBySessionId } from '../utils/session.server'
import { htmlToPlainText } from '~/utils/stringHelpers'

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function getContext(
  user_id: number | null,
  query: string,
): Promise<{ messages: Message[]; id: number | undefined }> {
  if (!user_id) {
    return { messages: [{ role: 'user', content: query }], id: undefined }
  }
  const history = await selectMany<{ history: Message[]; id: number }>(
    db,
    'SELECT id, history from chat_history WHERE user_id = ?',
    [user_id],
  )

  if (history.length === 0) {
    return { messages: [{ role: 'user', content: query }], id: undefined }
  }

  const currentConvo = history[0].history
  currentConvo.push({ role: 'user', content: query })
  return { messages: currentConvo, id: history[0].id }
}

async function newContext(
  user_id: number | null,
  company_id: number,
  query: string,
): Promise<{ history: Message[]; id: number | undefined }> {
  const isEmployee = user_id !== null && user_id !== undefined
  const publicFlag = isEmployee ? 0 : 1

  const instructions = await selectMany<InstructionSlim>(
    db,
    'SELECT id, title, rich_text from instructions WHERE company_id = ? AND public = ?',
    [company_id, publicFlag],
  )

  const cleanedInstructions = instructions.map(inst => ({
    ...inst,
    rich_text: htmlToPlainText(inst.rich_text),
  }))

  const systemPrompt = `Here is your context: ${JSON.stringify(cleanedInstructions)}.
        Follow ALL instructions strictly without exceptions.
        Your task is to provide the MOST complete and accurate answer to the user's request based ONLY on this context.
        Do NOT add unnecessary information, assumptions, or commentary.
        Return only what is explicitly required by the request and the given instructions.`

  console.log('System Prompt:', systemPrompt)

  const chatHistory = user_id
    ? await selectMany<{ id: number }>(
        db,
        'SELECT id from chat_history WHERE user_id = ?',
        [user_id],
      )
    : []

  let chatHistoryId: number | undefined
  if (chatHistory.length > 0) {
    chatHistoryId = chatHistory[0].id
  }
  return {
    history: [
      {
        role: 'system',
        content: systemPrompt,
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
  const urlCompanyId = url.get('companyId') ? Number(url.get('companyId')) : null

  if (!activeSession && !urlCompanyId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = activeSession ? (await getUserBySessionId(activeSession)) || null : null
  const companyId = user?.company_id || urlCompanyId

  if (!companyId) {
    return new Response('Company not identified', { status: 400 })
  }

  let messages: Message[] = []
  let chatHistoryId: number | undefined

  if (isNew) {
    const result = await newContext(user?.id || null, companyId, query)
    messages = result.history
    chatHistoryId = result.id
  } else {
    const result = await getContext(user?.id || null, query)
    messages = result.messages
    chatHistoryId = result.id
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini-2025-04-14',
    messages: messages,
    temperature: 0,
    max_tokens: 1024,
    stream: true,
  })

  return eventStream(
    request.signal,
    function setup(send) {
      // Используем SSE комментарии для заполнения буфера
      // Комментарии начинаются с ':' и не отображаются клиенту
      for (let i = 0; i < 30; i++) {
        send({ event: 'ping', data: '' })
      }

      // Информационное сообщение отправляем как комментарий (не будет видно пользователю)
      send({ event: 'info', data: 'Connecting to AI...' })

      ;(async () => {
        let answer = ''

        try {
          for await (const chunk of response) {
            const message = chunk.choices[0].delta.content
            if (message) {
              send({ data: message })
              answer += message
            }
          }

          send({ data: DONE_KEY })

          if (user) {
            if (chatHistoryId) {
              updateContext(user.id, chatHistoryId, messages, answer)
            } else {
              insertContext(user.id, messages, answer)
            }
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
