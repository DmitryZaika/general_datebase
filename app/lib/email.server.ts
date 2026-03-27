import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createTransport } from 'nodemailer'
import type { Attachment } from 'nodemailer/lib/mailer'

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION ?? 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_EMAIL || '',
    secretAccessKey: process.env.AWS_EMAIL_SECRET || '',
  },
})

const transporter = createTransport({
  SES: { sesClient, SendEmailCommand },
})

type MailOptions = Parameters<typeof transporter.sendMail>[0]
export type MailReturn = Awaited<ReturnType<typeof transporter.sendMail>>

export interface SendEmail {
  to: string | string[]
  from?: string
  subject: string
  html?: string
  text?: string
  replyTo?: string[]
  inReplyTo?: string
  headers?: Record<string, string>
  attachments?: File[]
}

async function filesToAttachments(files?: File[]): Promise<Attachment[] | undefined> {
  if (!files?.length) return undefined

  const mapped = await Promise.all(
    files.map(async f => {
      const ab = await f.arrayBuffer()
      return {
        filename: f.name,
        content: Buffer.from(ab),
        contentType: f.type || undefined,
      } satisfies Attachment
    }),
  )

  return mapped
}

export async function sendEmail({
  to,
  from,
  subject,
  html,
  text,
  replyTo,
  inReplyTo,
  attachments,
}: SendEmail): Promise<MailReturn> {
  const toSend: MailOptions = {
    to: Array.isArray(to) ? to : [to],
    replyTo,
    inReplyTo,
    from: from || 'noreply@granite-manager.com',
    subject,
    html: html,
    text: text,
    attachments: await filesToAttachments(attachments),
  }

  return await transporter.sendMail(toSend)
}

export async function sendPaymentEmail(to: string, uuid: string) {
  const url = `${process.env.APP_URL}/customers/${uuid}`
  const html = `
    <p>
         Thank you for your purchase. You can <a href="${url}">pay for your order here</a>.
    </p>
    `
  await sendEmail({ to, subject: 'Payment Confirmation', html })
}
