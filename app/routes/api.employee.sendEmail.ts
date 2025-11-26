import type { SendEmailCommandOutput } from '@aws-sdk/client-ses'
import { type ActionFunctionArgs, data } from 'react-router'
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
})

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const userCompany = await selectId<{ domain: string }>(
    db,
    'SELECT domain from company where id = ?',
    user.company_id,
  )

  const from = userCompany?.domain ? user.email : 'no-reply@granite-manager.com'
  const replyTo = userCompany?.domain ? undefined : [user.email]

  const raw = await request.json()
  const cleaned = customerSchema.parse(raw)

  const HTMLBody = `<div style="white-space: pre-wrap;">${cleaned.body}</div>`

  let info: SendEmailCommandOutput
  try {
    info = await sendEmail({
      to: cleaned.to,
      from,
      subject: cleaned.subject,
      html: HTMLBody,
      configurationSet: 'email-tracking-set',
      replyTo,
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
    `INSERT INTO emails (user_id, subject, body, message_id)
     VALUES (?, ?, ?, ?)`,
    [user.id, cleaned.subject, cleaned.body, messageId],
  )

  return data({ ok: true })
}
