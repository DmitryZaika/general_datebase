import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '~/db.server'
import { type MailReturn, sendEmail } from '~/lib/email.server'
import {
  replaceTemplateVariables,
  type TemplateVariableData,
} from '~/utils/emailTemplateVariables'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'
import { uploadStreamToS3 } from '~/utils/s3.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { parseEmailAddress } from '~/utils/stringHelpers'

export const emailSchema = z.object({
  to: z.array(z.email()).min(1),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(10000),
  dealId: z.coerce.number().min(1).int().optional(),
  threadId: z.string().optional(),
  attachments: z.array(z.instanceof(File)),
})

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

async function fetchCustomerDataByEmail(
  recipientEmail: string,
  companyId: number,
): Promise<TemplateVariableData['customer']> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT name, address FROM customers WHERE email = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1`,
    [recipientEmail, companyId],
  )

  if (rows?.[0]) {
    return {
      name: rows[0].name || undefined,
      address: rows[0].address || undefined,
    }
  }

  return undefined
}

async function fetchCompanyData(
  companyId: number,
): Promise<TemplateVariableData['company']> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT name, address FROM company WHERE id = ?',
    [companyId],
  )

  if (rows?.[0]) {
    return {
      name: rows[0].name || undefined,
      address: rows[0].address || undefined,
    }
  }

  return undefined
}

interface UserData {
  email_signature: string | null
  email_name: string | null
}

const emailToSend = async (
  user: User,
  cleaned: Omit<Email, 'to'>,
  recipient: string,
) => {
  const userCompany = await selectId<{ domain: string | null }>(
    db,
    'SELECT domain from company where id = ?',
    user.company_id,
  )

  // Изменено: получаем и подпись, и имя (email_name)
  const userData = await selectId<UserData>(
    db,
    'SELECT email_signature, email_name FROM users WHERE id = ? AND is_deleted = 0',
    user.id,
  )

  // Break glass in case of emergency
  const emailData = await selectId<{ message_id: string }>(
    db,
    'SELECT message_id FROM emails WHERE thread_id = ? ORDER BY sent_at DESC LIMIT 1;',
    user.id,
  )

  const bodyWithSignature = appendEmailSignature(
    cleaned.body,
    userData?.email_signature,
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

  const emailAddress = fromEmail(userCompany?.domain || null, user.email)

  // Изменено: формируем строку отправителя в формате "Имя <email>"
  const from = userData?.email_name
    ? `"${userData.email_name}" <${emailAddress}>`
    : emailAddress

  return {
    to: recipient,
    from,
    subject: cleaned.subject,
    html: HTMLBody,
    text: textBody,
    attachments: cleaned.attachments,
    // Break glass in case of emergency
    inReplyTo: emailData?.message_id,
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const user: User | null = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const to = formData
    .getAll('to')
    .filter((value): value is string => typeof value === 'string')
  const attachments = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File)

  const raw = {
    to,
    subject: formData.get('subject'),
    body: formData.get('body'),
    dealId: formData.get('dealId') || undefined,
    threadId: formData.get('threadId') || undefined,
    attachments,
  }
  const cleaned = emailSchema.parse(raw)

  const uploadedAttachments: {
    contentType: string
    contentSubtype: string
    filename: string
    url: string
  }[] = []

  for (const file of cleaned.attachments) {
    const ab = await file.arrayBuffer()
    const buffer = Buffer.from(ab)
    const filename = `${uuidv4()}-${file.name}`
    const url = await uploadStreamToS3(
      (async function* () {
        yield new Uint8Array(buffer)
      })(),
      filename,
      'emails',
    )

    const [type, subtype] = (file.type || 'application/octet-stream').split('/')

    uploadedAttachments.push({
      contentType: type ?? 'application',
      contentSubtype: subtype ?? '',
      filename: file.name ?? '',
      url: url ?? '',
    })
  }

  const sendResults: {
    messageId: string
    senderEmail: string
    receiverEmail: string
    threadId: string
    personalizedBody: string
  }[] = []

  const companyData = user.company_id
    ? await fetchCompanyData(user.company_id)
    : undefined

  for (const recipient of cleaned.to) {
    const threadId =
      cleaned.to.length === 1 && cleaned.threadId ? cleaned.threadId : uuidv4()

    const recipientCustomerData = user.company_id
      ? await fetchCustomerDataByEmail(recipient, user.company_id)
      : undefined

    const templateVariableData: TemplateVariableData = {
      user: {
        name: user.name || undefined,
        email: user.email,
        phone_number: user.phone_number || undefined,
      },
      customer: recipientCustomerData,
      company: companyData,
    }

    const personalizedBody = replaceTemplateVariables(
      cleaned.body,
      templateVariableData,
    )

    const emailInformation = await emailToSend(
      user,
      {
        subject: cleaned.subject,
        body: personalizedBody,
        dealId: cleaned.dealId,
        threadId: cleaned.threadId,
        attachments: cleaned.attachments,
      },
      recipient,
    )

    console.log('emailInformation', emailInformation)

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

    sendResults.push({
      messageId: info.messageId,
      senderEmail: parseEmailAddress(emailInformation.from || ''),
      receiverEmail: parseEmailAddress(recipient),
      threadId,
      personalizedBody,
    })
  }

  for (const sendResult of sendResults) {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO emails (sender_user_id, subject, body, message_id, sender_email, receiver_email, thread_id, deal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        cleaned.subject,
        sendResult.personalizedBody,
        sendResult.messageId,
        sendResult.senderEmail,
        sendResult.receiverEmail,
        sendResult.threadId,
        cleaned.dealId || null,
      ],
    )

    const emailId = result.insertId

    for (const attachment of uploadedAttachments) {
      await db.execute(
        `INSERT INTO email_attachments (email_id, content_type, content_subtype, filename, url)
         VALUES (?, ?, ?, ?, ?)`,
        [
          emailId,
          attachment.contentType,
          attachment.contentSubtype,
          attachment.filename,
          attachment.url,
        ],
      )
    }
  }

  return data({ ok: true })
}
