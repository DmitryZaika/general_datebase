import { type ActionFunctionArgs, data } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '~/db.server'
import { type MailReturn, sendEmail } from '~/lib/email.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'

export const emailSchema = z.object({
  to: z.union([z.email(), z.array(z.email())]),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(10000),
  dealId: z.coerce.number().min(1).int().optional(),
  threadId: z.uuid().optional(),
  attachments: z.array(z.instanceof(File)),
})

const cleanId = (value: string): string => {
  return value.slice(1).split('@')[0]
}

type Email = z.infer<typeof emailSchema>
const DEFAULT_EMAIL = 'sales@granite-manager.com'

const fromEmail = (companyDomain: string | null, userEmail: string) => {
  if (!companyDomain) return DEFAULT_EMAIL
  if (userEmail.includes(companyDomain)) return userEmail
  return DEFAULT_EMAIL
}

const appendEmailSignature = (body: string, signature: string | null | undefined) => {
  const cleanBody = body.trim()
  const cleanSignature = (signature || '').trim()
  if (!cleanSignature) return cleanBody
  if (cleanBody.includes(cleanSignature)) return cleanBody
  const sign = cleanSignature.startsWith('--') ? cleanSignature : `—\n${cleanSignature}`
  return `${cleanBody}\n\n${sign}`
}

const emailToSend = async (user: SessionUser, cleaned: Email) => {
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

  const softOptOutText = "\n\nIf you'd prefer I stop, just reply and tell me."

  const textBody = bodyWithSignature + softOptOutText
  const HTMLBody = `<html>
    <body>
      <div style="white-space: pre-wrap;">${bodyWithSignature}</div>
      <div style="margin-top: 24px; font-size: 12px; color: #666666;">
        If you'd prefer I stop, just reply and tell me.
      </div>
    </body>
  </html>`

  const from = fromEmail(userCompany?.domain || null, user.email)

  return {
    to: cleaned.to,
    from,
    subject: cleaned.subject,
    html: HTMLBody,
    text: textBody,
    attachments: cleaned.attachments,
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()

  const raw = {
    to: formData.get('to'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    dealId: Number(formData.get('dealId')),
    attachments: formData.getAll('attachments'),
  }
  const cleaned = emailSchema.parse(raw)
  const threadId = cleaned.threadId || uuidv4()

  const emailInformation = await emailToSend(user, cleaned)
  let info: MailReturn
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

  const messageId = cleanId(info.messageId)

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
