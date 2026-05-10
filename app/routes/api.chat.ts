import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { streamTask } from '~/lib/ai/runner.server'
import { sseResponse } from '~/lib/ai/streaming.server'
import { chatTask, type InstructionItem } from '~/lib/ai/tasks/chat.task'
import type { ChatMessage } from '~/lib/ai/types'
import { getSession } from '~/sessions.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getUserBySessionId } from '~/utils/session.server'

interface ChatHistoryRow {
  id: number
  history: ChatMessage[]
}

async function loadHistory(userId: number): Promise<ChatHistoryRow | null> {
  const rows = await selectMany<ChatHistoryRow>(
    db,
    'SELECT id, history FROM chat_history WHERE user_id = ?',
    [userId],
  )
  return rows[0] ?? null
}

async function loadInstructions(companyId: number): Promise<InstructionItem[]> {
  return selectMany<InstructionItem>(
    db,
    'SELECT id, title, rich_text FROM instructions WHERE company_id = ?',
    [companyId],
  )
}

async function persistHistory(
  userId: number,
  existingId: number | null,
  messages: ChatMessage[],
): Promise<void> {
  const json = JSON.stringify(messages)
  if (existingId) {
    await db.execute(
      'UPDATE chat_history SET history = ? WHERE id = ? AND user_id = ?',
      [json, existingId, userId],
    )
  } else {
    await db.execute('INSERT INTO chat_history (history, user_id) VALUES (?, ?)', [
      json,
      userId,
    ])
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const sessionId = session.data.sessionId
  if (!sessionId) return new Response('Unauthorized', { status: 401 })

  const user = await getUserBySessionId(sessionId)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url).searchParams
  const query = url.get('query') ?? ''
  const isNew = url.get('isNew') === 'true'

  const existingHistory = isNew ? null : await loadHistory(user.id)
  const input = isNew
    ? {
        mode: 'new' as const,
        query,
        instructions: await loadInstructions(user.company_id),
      }
    : {
        mode: 'continue' as const,
        query,
        history: existingHistory?.history ?? [],
      }
  const messagesForPersistence = chatTask.buildMessages(input)

  return sseResponse(async send => {
    const { full } = await streamTask(
      chatTask,
      input,
      delta => send({ type: 'delta', content: delta }),
      user.id,
    )
    try {
      const updated: ChatMessage[] = [
        ...messagesForPersistence,
        { role: 'assistant', content: full },
      ]
      await persistHistory(user.id, existingHistory?.id ?? null, updated)
    } catch (err) {
      posthogClient.captureException(err)
    }
  })
}
