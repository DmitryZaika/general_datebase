import type { SendEmailCommandOutput } from '@aws-sdk/client-ses'
import { type ActionFunctionArgs, data } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '~/db.server'
import { sendEmail } from '~/lib/email.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'

export const customerSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(10000),
  dealId: z.coerce.number().min(1).int().optional(),
  threadId: z.uuid().optional(),
})

type Customer = z.infer<typeof customerSchema>

const fromEmail = (companyDomain: string | null, userEmail: string) => {
  const DEFAULT_EMAIL = 'sales@granite-manager.com'
  if (!companyDomain) return DEFAULT_EMAIL
  if (userEmail.includes(companyDomain)) return userEmail
  return DEFAULT_EMAIL
}

const appendEmailSignature = (body: string, signature: string | null | undefined) => {
  const cleanBody = body.trim()
  const cleanSignature = (signature || '').trim()
  if (!cleanSignature) return cleanBody
  if (cleanBody.includes(cleanSignature)) return cleanBody
  const sign =
    cleanSignature.startsWith('--') || cleanSignature.startsWith('—')
      ? cleanSignature
      : `—\n${cleanSignature}`
  return `${cleanBody}\n\n${sign}`
}

const emailToSend = async (user: SessionUser, cleaned: Customer) => {
  const userCompany = await selectId<{ domain: string | null }>(
    db,
    'SELECT domain from company where id = ?',
    user.company_id,
  )
  const userSignature = await selectId<{ email_signature: string | null }>(
    db,
    'SELECT email_signature FROM users WHERE id = ? AND is_deleted = 0',
    user.id,
  )
  const bodyWithSignature = appendEmailSignature(
    cleaned.body,
    userSignature?.email_signature,
  )
  const HTMLBody = `<div style="white-space: pre-wrap;">${bodyWithSignature}</div>`
  const from = fromEmail(userCompany?.domain || null, user.email)
  const to = cleaned.to
  return {
    to,
    from,
    subject: cleaned.subject,
    html: HTMLBody,
    configurationSet: 'email-tracking-set',
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json()
  const cleaned = customerSchema.parse(raw)
  const threadId = cleaned.threadId || uuidv4()

  const emailInformation = await emailToSend(user, cleaned)
  let info: SendEmailCommandOutput
  try {
    info = await sendEmail(emailInformation)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
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
    [
      user.id,
      cleaned.subject,
      cleaned.body,
      messageId,
      emailInformation.from,
      emailInformation.to,
      threadId,
      cleaned.dealId,
    ],
  )

  return data({ ok: true })
}
