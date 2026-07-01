import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data } from 'react-router'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '~/db.server'
import { type MailReturn, sendEmail } from '~/lib/email.server'
import { replaceTemplateVariables } from '~/services/lambda.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { uploadStreamToS3 } from '~/utils/s3.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { parseEmailAddress } from '~/utils/stringHelpers'

export const emailSchema = z.object({
  to: z.array(z.email()).min(1),
  subject: z.string().min(1).max(300),
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
): Promise<null | number> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM customers WHERE email = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1`,
    [recipientEmail, companyId],
  )

  return rows[0]?.id
}

function unwrapBrackets(input: string): string {
  if (input.startsWith('<') && input.endsWith('>')) {
    return input.slice(1, -1)
  }
  return input
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
  let emailData: { message_id: string } | undefined
  if (cleaned.threadId) {
    const results = await selectMany<{ message_id: string }>(
      db,
      'SELECT message_id FROM emails WHERE thread_id = ? ORDER BY sent_at DESC LIMIT 1;',
      [cleaned.threadId],
    )
    emailData = results[0]
  }

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

const COMPRESSION_THRESHOLD_BYTES = 25 * 1024 * 1024
const IMAGE_MAX_DIMENSION = 1920
const JPEG_QUALITY = 80

const COMPRESSIBLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/avif',
]

async function compressAttachment(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type)) {
    return file
  }

  try {
    const ab = await file.arrayBuffer()
    const originalBuffer = Buffer.from(ab)

    const compressedBuffer = await sharp(originalBuffer)
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()

    if (compressedBuffer.length >= originalBuffer.length) {
      return file
    }

    return new File([Uint8Array.from(compressedBuffer)], file.name, {
      type: 'image/jpeg',
    })
  } catch {
    return file
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
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

    if (cleaned.dealId !== undefined) {
      const dealAccess = await selectMany<{ id: number }>(
        db,
        `SELECT d.id FROM deals d
         INNER JOIN customers c ON c.id = d.customer_id
         WHERE d.id = ? AND d.deleted_at IS NULL AND c.company_id = ?
         LIMIT 1`,
        [cleaned.dealId, user.company_id],
      )
      if (!dealAccess.length) {
        return data({ error: 'Deal not found' }, { status: 400 })
      }
    }

    const totalRawBytes = cleaned.attachments.reduce((sum, f) => sum + f.size, 0)
    let finalAttachments: File[] = cleaned.attachments

    if (totalRawBytes > COMPRESSION_THRESHOLD_BYTES) {
      const compressed = await Promise.all(
        cleaned.attachments.map(f => compressAttachment(f)),
      )
      finalAttachments = compressed
    }

    const attachmentBuffers: { buffer: Buffer; name: string; type: string }[] = []
    for (const file of finalAttachments) {
      const ab = await file.arrayBuffer()
      attachmentBuffers.push({
        buffer: Buffer.from(ab),
        name: file.name,
        type: file.type || 'application/octet-stream',
      })
    }

    const uploadedAttachments: {
      contentType: string
      contentSubtype: string
      filename: string
      url: string
    }[] = []

    for (const att of attachmentBuffers) {
      const filename = `${uuidv4()}-${att.name}`
      const url = await uploadStreamToS3(
        (async function* () {
          yield new Uint8Array(att.buffer)
        })(),
        filename,
        'emails',
      )

      const [type, subtype] = att.type.split('/')

      uploadedAttachments.push({
        contentType: type ?? 'application',
        contentSubtype: subtype ?? '',
        filename: att.name ?? '',
        url: url ?? '',
      })
    }

    const emailAttachments: File[] = attachmentBuffers.map(
      att => new File([Uint8Array.from(att.buffer)], att.name, { type: att.type }),
    )

    const sendResults: {
      messageId: string
      senderEmail: string
      receiverEmail: string
      threadId: string
      personalizedBody: string
    }[] = []

    for (const recipient of cleaned.to) {
      const threadId =
        cleaned.to.length === 1 && cleaned.threadId ? cleaned.threadId : uuidv4()

      let info: MailReturn
      let personalizedBody = cleaned.body
      let emailInformation: Awaited<ReturnType<typeof emailToSend>>
      try {
        const customerId = await fetchCustomerDataByEmail(recipient, user.company_id)
        personalizedBody = await replaceTemplateVariables(
          user.id,
          cleaned.dealId ?? null,
          user.company_id,
          customerId,
          cleaned.body,
        )

        emailInformation = await emailToSend(
          user,
          {
            subject: cleaned.subject,
            body: personalizedBody,
            dealId: cleaned.dealId,
            threadId: cleaned.threadId,
            attachments: emailAttachments,
          },
          recipient,
        )

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
        messageId: unwrapBrackets(info.messageId),
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0]
      const msg = issue?.message || 'Invalid email payload'
      return data({ error: msg }, { status: 400 })
    }
    return data({ error: 'Email failed to send' }, { status: 500 })
  }
}
