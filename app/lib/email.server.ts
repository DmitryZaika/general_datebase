import { SESClient } from '@aws-sdk/client-ses'

if (!process.env.AWS_EMAIL || !process.env.AWS_EMAIL_SECRET) {
  throw new Error('AWS_EMAIL and AWS_EMAIL_SECRET must be set')
}

const ses = new SESClient({
  region: process.env.AWS_REGION ?? 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_EMAIL,
    secretAccessKey: process.env.AWS_EMAIL_SECRET,
  },
})

import { SendEmailCommand } from '@aws-sdk/client-ses'

interface SendEmail {
  to: string
  subject: string
  html?: string
  text?: string
}

interface Body {
  Html?: { Data: string; Charset: string }
  Text?: { Data: string; Charset: string }
}

export async function sendEmail({ to, subject, html, text }: SendEmail) {
  const body: Body = {}
  if (html) body.Html = { Data: html, Charset: 'UTF-8' }
  if (text) body.Text = { Data: text, Charset: 'UTF-8' }

  await ses.send(
    new SendEmailCommand({
      Destination: { ToAddresses: [to] },
      Source: 'noreply@granite-manager.com',
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: body,
      },
    }),
  )
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
