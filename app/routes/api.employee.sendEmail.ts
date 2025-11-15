import { type ActionFunctionArgs, data } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { sendEmail } from '~/lib/email.server'
import { getEmployeeUser } from '~/utils/session.server'

export const customerSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(1000),
})

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST')
    return data({ error: 'Method not allowed' }, { status: 405 })

  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json()
  const cleaned = customerSchema.parse(raw)

  let info
  try {
    info = await sendEmail({
      to: cleaned.to,
      from: user.email,
      subject: cleaned.subject,
      text: cleaned.body,
    })
    console.log(info)
  } catch (error) {
    const message = error.message
    if (message.includes('Email address is not verified.')) {
      return data({ error: 'Invalid email address' }, { status: 400 })
    }
    return data({ error: 'Email failed to send' }, { status: 400 })
  }

  const messageId = info.MessageId

  return data({ ok: true })
}
