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

async function getChatMessages(
  user_id: number | null,
  company_id: number,
  query: string,
  isNew: boolean,
  clientHistory: Message[] = [],
): Promise<{ messages: Message[]; chatHistoryId: number | undefined }> {
  // 1. Get Instructions for System Prompt
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

  const contextText = cleanedInstructions
    .map(inst => `[INSTRUCTION: ${inst.title}]\n${inst.rich_text}`)
    .join('\n\n')

  const systemPrompt = `You are a Context-Locked Company Assistant. 
You have access to the following COMPANY_INSTRUCTIONS.

STRICT ADHERENCE RULES:
1. Use ONLY the wording and facts found in COMPANY_INSTRUCTIONS.
2. If the user asks you to finish a sentence or provides a partial statement from the instructions, you MUST complete it using the EXACT text from the instructions.
3. DO NOT use any outside knowledge, assumptions, or "helpful" information not explicitly written in the context.
4. DO NOT provide commentary, introductions, or pleasantries. Return only the requested information.
5. If the information is not present in the instructions, respond: "I do not have that information in my instructions."

COMPANY_INSTRUCTIONS:
${contextText}

END OF CONTEXT. 
Now, process the user request strictly following the rules above.`

  console.log('--- System Prompt ---')
  console.log(systemPrompt)
  console.log('---------------------')

  // 2. Build Message History
  const messages: Message[] = [{ role: 'system', content: systemPrompt }]
  let chatHistoryId: number | undefined

  if (user_id) {
    // Employee logic: Get history from DB
    const history = await selectMany<{ history: Message[]; id: number }>(
      db,
      'SELECT id, history from chat_history WHERE user_id = ?',
      [user_id],
    )

    if (history.length > 0 && !isNew) {
      chatHistoryId = history[0].id
      // Filter out any old system prompts and prepend the new one
      const previousConvo = history[0].history.filter(m => m.role !== 'system')
      messages.push(...previousConvo)
    }
  } else {
    // Guest logic: Use history from client
    if (clientHistory.length > 0) {
      // Filter out any client-side system prompts just in case
      messages.push(...clientHistory.filter(m => m.role !== 'system'))
    }
  }

  // Add the current query if it's not already the last message
  if (
    messages.length === 0 ||
    messages[messages.length - 1].content !== query ||
    messages[messages.length - 1].role !== 'user'
  ) {
    messages.push({ role: 'user', content: query })
  }

  return { messages, chatHistoryId }
}

async function insertContext(user_id: number, messages: Message[], answer: string) {
  const historyToSave = [...messages, { role: 'assistant' as const, content: answer }]
  await db.execute(`INSERT INTO chat_history (history, user_id) VALUES (?, ?);`, [
    JSON.stringify(historyToSave),
    user_id,
  ])
}

async function updateContext(
  userId: number,
  chatHistoryId: number,
  messages: Message[],
  answer: string,
) {
  const historyToSave = [...messages, { role: 'assistant' as const, content: answer }]
  await db.execute(
    `UPDATE chat_history SET history = ? WHERE id = ? AND user_id = ?;`,
    [JSON.stringify(historyToSave), chatHistoryId, userId],
  )
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  const url = new URL(request.url).searchParams
  const query = url.get('query') || ''
  const isNew = url.get('isNew') === 'true'
  const urlCompanyId = url.get('companyId') ? Number(url.get('companyId')) : null
  const historyRaw = url.get('history')
  let clientHistory: Message[] = []

  if (historyRaw) {
    try {
      clientHistory = JSON.parse(decodeURIComponent(historyRaw))
    } catch (e) {
      console.error('Failed to parse history from URL', e)
    }
  }

  if (!activeSession && !urlCompanyId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = activeSession ? (await getUserBySessionId(activeSession)) || null : null
  const companyId = user?.company_id || urlCompanyId

  if (!companyId) {
    return new Response('Company not identified', { status: 400 })
  }

  const { messages, chatHistoryId } = await getChatMessages(
    user?.id || null,
    companyId,
    query,
    isNew,
    clientHistory,
  )

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
