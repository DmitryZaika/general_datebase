import type { RowDataPacket } from 'mysql2'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { streamStructuredTask } from '~/lib/ai/runner.server'
import { sseResponse } from '~/lib/ai/streaming.server'
import {
  type EmailHistoryItem,
  GenerateEmailParams,
  generateEmailTask,
  type LeadInfo,
  type SenderInfo,
} from '~/lib/ai/tasks/generateEmail.task'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const requestSchema = GenerateEmailParams.extend({
  dealId: z.number().optional(),
  threadId: z.uuid().optional(),
  skipHistory: z.boolean().optional(),
})

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getSenderInfo(user: {
  name: string
  company_id?: number
  phone_number?: string
  email?: string
  position_id?: number
}): Promise<SenderInfo> {
  const sender: SenderInfo = {
    name: user.name,
    phone: user.phone_number,
    email: user.email,
  }
  if (!user.company_id && !user.position_id) return sender

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT name FROM company WHERE id = ? LIMIT 1) AS companyName,
       (SELECT name FROM positions WHERE id = ? LIMIT 1) AS positionName`,
    [user.company_id ?? 0, user.position_id ?? 0],
  )
  if (rows?.[0]) {
    sender.company = rows[0].companyName ?? undefined
    sender.position = rows[0].positionName ?? undefined
  }
  return sender
}

async function getLeadInfo(dealId?: number): Promise<LeadInfo> {
  if (!dealId) return {}
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name AS customerName, c.company_name AS customerCompany,
            c.details, c.your_message, c.referral_source, c.remodal_type
       FROM deals d JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )
  if (!rows?.length) return {}
  const row = rows[0]
  return {
    customerName: row.customerName ?? undefined,
    customerCompany: row.customerCompany ?? undefined,
    leadMessage: row.details ?? row.your_message ?? undefined,
    remodelType: row.remodal_type ?? undefined,
    referralSource: row.referral_source ?? undefined,
  }
}

async function getEmailHistory(
  dealId: number,
  threadId?: string,
  subject?: string,
): Promise<EmailHistoryItem[]> {
  let query: string
  let params: (number | string)[]
  if (threadId) {
    query = `SELECT body, sent_at, sender_user_id FROM emails
              WHERE deleted_at IS NULL AND thread_id = ?
                AND (deal_id = ? OR deal_id IS NULL)
              ORDER BY sent_at ASC`
    params = [threadId, dealId]
  } else if (subject) {
    query = `SELECT body, sent_at, sender_user_id FROM emails
              WHERE deal_id = ? AND deleted_at IS NULL AND subject = ?
              ORDER BY sent_at ASC`
    params = [dealId, subject]
  } else {
    query = `SELECT body, sent_at, sender_user_id FROM emails
              WHERE deal_id = ? AND deleted_at IS NULL
              ORDER BY sent_at ASC`
    params = [dealId]
  }
  const [rows] = await db.execute<RowDataPacket[]>(query, params)
  return rows.map(r => ({
    body: r.body,
    sentAt: r.sent_at,
    isFromCustomer: r.sender_user_id === null,
  }))
}

export async function action({ request }: ActionFunctionArgs) {
  let user: Awaited<ReturnType<typeof getEmployeeUser>>
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return errorResponse('Failed to authorize', 401)
  }

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return errorResponse('Invalid request data', 400)
  }

  const sender = await getSenderInfo(user)
  const lead = await getLeadInfo(parsed.dealId)
  const history =
    parsed.skipHistory || !parsed.dealId
      ? []
      : await getEmailHistory(parsed.dealId, parsed.threadId, parsed.subject)

  return sseResponse(async send => {
    const { parsed: result } = await streamStructuredTask(
      generateEmailTask,
      { params: parsed, lead, sender, history },
      delta => send({ type: 'delta', content: delta }),
      user.id,
    )
    send({ type: 'final', data: result })
  })
}
