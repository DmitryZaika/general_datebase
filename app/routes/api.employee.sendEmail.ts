import type { SendEmailCommandOutput } from '@aws-sdk/client-ses'
import { type ActionFunctionArgs, data } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '~/db.server'
import { sendEmail } from '~/lib/email.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export const customerSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(10000),
  dealId: z.coerce.number().min(1).int().optional(),
  threadId: z.string().uuid().optional(),
})

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const userCompany = await selectId<{ domain: string | null }>(
    db,
    'SELECT domain from company where id = ?',
    user.company_id,
  )

  const raw = await request.json()
  const cleaned = customerSchema.parse(raw)
  const dealId = cleaned.dealId
  const rawFrom = userCompany?.domain ? user.email : 'sales@granite-manager.com'
  const from = userCompany?.domain ? user.email : 'sales@granite-manager.com'
  const to = cleaned.to
  const threadId = cleaned.threadId || uuidv4()

  const HTMLBody = `<div style="white-space: pre-wrap;">${cleaned.body}</div>`

  let info: SendEmailCommandOutput
  try {
    info = await sendEmail({
      to,
      from,
      subject: cleaned.subject,
      html: HTMLBody,
      configurationSet: 'email-tracking-set',
    })
  } catch (error) {
    const message = (error as { message?: string }).message || 'Unknown error'
    if (message.includes('Email address is not verified.')) {
      posthogClient.captureException(error, user.email)
      return data({ error: 'Invalid email address' }, { status: 400 })
    }
    posthogClient.captureException(error, user.email)
    return data({ error: 'Email failed to send' }, { status: 400 })
  }

  const messageId = info.MessageId

  await db.execute(
    `INSERT INTO emails (sender_user_id, subject, body, message_id, sender_email, receiver_email, thread_id, deal_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, cleaned.subject, cleaned.body, messageId, from, to, threadId, dealId],
  )

  return data({ ok: true })
}
