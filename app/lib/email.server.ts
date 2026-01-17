import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createTransport } from 'nodemailer'

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
type NodeMailerAttachments = MailOptions['attachments']
export type MailReturn = Awaited<ReturnType<typeof transporter.sendMail>>

export interface SendEmail {
  to: string | string[]
  from?: string
  subject: string
  html?: string
  text?: string
  replyTo?: string[]
  headers?: Record<string, string>
  attachments?: NodeMailerAttachments
}

export async function sendEmail({
  to,
  from,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: SendEmail): Promise<MailReturn> {
  const toSend: MailOptions = {
    to: Array.isArray(to) ? to : [to],
    replyTo,
    from: from || 'noreply@granite-manager.com',
    subject,
    html: html,
    text: text,
    attachments,
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
