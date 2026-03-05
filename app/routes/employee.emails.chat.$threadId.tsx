import type { RowDataPacket } from 'mysql2'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { EmailChat } from '~/components/EmailChat'
import { db } from '~/db.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { parseEmailAddress } from '~/utils/stringHelpers'

interface Attachment {
  id: number
  email_id: number
  content_type: string
  content_subtype: string
  filename: string
  url: string
  signed_url?: string
}

interface Message {
  id: number
  subject: string
  body: string
  signature?: string | null
  sent_at: string
  isFromCustomer: boolean
  read_at?: string
  employee_read_at?: string
  attachments?: Attachment[]
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const [userSignatureRows] = await db.execute<RowDataPacket[]>(
    'SELECT email_signature FROM users WHERE id = ?',
    [user.id],
  )
  const currentUserSignature = userSignatureRows?.[0]?.email_signature || null
  const threadId = params.threadId
  if (!threadId) {
    posthogClient.captureException(new Error('Thread ID is missing'))
    throw new Error('Thread ID is missing')
  }

  const [dealRows] = await db.execute<RowDataPacket[]>(
    'SELECT deal_id FROM emails WHERE thread_id = ? AND deal_id IS NOT NULL LIMIT 1',
    [threadId],
  )

  const dealId = dealRows?.[0]?.deal_id || null

  const normalizeEmail = (email: string | null | undefined) =>
    parseEmailAddress(email).toLowerCase() || ''

  let customerName = 'Customer'
  let customerEmail = ''
  let customerId: number | null = null

  if (dealId) {
    const [customerRows] = await db.execute<RowDataPacket[]>(
      `SELECT c.name, c.email, d.customer_id
         FROM deals d
         JOIN customers c ON d.customer_id = c.id
        WHERE d.id = ?`,
      [dealId],
    )
    customerName = customerRows?.[0]?.name || 'Customer'
    customerEmail = normalizeEmail(customerRows?.[0]?.email || '')
    customerId = customerRows?.[0]?.customer_id
  } else {
    const [threadEmails] = await db.execute<RowDataPacket[]>(
      `SELECT sender_email, receiver_email FROM emails WHERE thread_id = ? LIMIT 1`,
      [threadId],
    )

    if (threadEmails && threadEmails.length > 0) {
      const { sender_email, receiver_email } = threadEmails[0]
      const sEmail = normalizeEmail(sender_email)
      const rEmail = normalizeEmail(receiver_email)

      const [custSender] = await db.execute<RowDataPacket[]>(
        `SELECT id, name, email FROM customers WHERE email = ?`,
        [sEmail],
      )

      if (custSender && custSender.length > 0) {
        customerName = custSender[0].name
        customerEmail = normalizeEmail(custSender[0].email)
        customerId = custSender[0].id
      } else {
        const [custReceiver] = await db.execute<RowDataPacket[]>(
          `SELECT id, name, email FROM customers WHERE email = ?`,
          [rEmail],
        )

        if (custReceiver && custReceiver.length > 0) {
          customerName = custReceiver[0].name
          customerEmail = normalizeEmail(custReceiver[0].email)
          customerId = custReceiver[0].id
        } else {
          if (sEmail === normalizeEmail(user.email)) {
            customerName = rEmail
            customerEmail = rEmail
          } else {
            customerName = sEmail
            customerEmail = sEmail
          }
        }
      }
    }
  }

  if (customerEmail) {
    let updateQuery = `
        UPDATE emails
        SET employee_read_at = NOW()
        WHERE deleted_at IS NULL
          AND thread_id = ?
          AND employee_read_at IS NULL
      `
    const updateParams: (string | number)[] = [threadId]

    if (dealId) {
      updateQuery += ` AND (deal_id = ? OR deal_id IS NULL)`
      updateParams.push(dealId)
    }

    if (customerId) {
      updateQuery += ` AND (sender_email = ? OR sender_email LIKE ? OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(sender_email, '<', -1), '>', 1))) = ? OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(sender_email, '<', -1), '>', 1))) IN (SELECT LOWER(email) FROM customers WHERE id = ? OR parent_id = ?))`
      updateParams.push(
        customerEmail,
        `%<${customerEmail}>`,
        customerEmail,
        customerId,
        customerId,
      )
    } else {
      updateQuery += ` AND (sender_email = ? OR sender_email LIKE ? OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(sender_email, '<', -1), '>', 1))) = ?)`
      updateParams.push(customerEmail, `%<${customerEmail}>`, customerEmail)
    }

    await db.execute(updateQuery, updateParams)
  }

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature as signature, MAX(er.read_at) AS read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
       LEFT JOIN users u ON u.id = e.sender_user_id
      WHERE e.deleted_at IS NULL AND e.thread_id = ?`
  const emailParams: (number | string)[] = [threadId]

  if (dealId) {
    emailQuery += ` AND (e.deal_id = ? OR e.deal_id IS NULL)`
    emailParams.push(dealId)
  }

  let attachQuery = `SELECT id, email_id, content_type, content_subtype, filename, url
     FROM email_attachments
     WHERE email_id IN (
       SELECT id
       FROM emails
       WHERE deleted_at IS NULL AND thread_id = ?`
  const attachParams: (number | string)[] = [threadId]

  if (dealId) {
    attachQuery += ` AND (deal_id = ? OR deal_id IS NULL)`
    attachParams.push(dealId)
  }
  attachQuery += ` )`

  const attachmentsRaw = await selectMany<Attachment>(db, attachQuery, attachParams)
  const attachments = await Promise.all(
    attachmentsRaw.map(async attachment => {
      const signed = await presignIfS3Uri(attachment.url)
      if (signed === attachment.url) return attachment
      return { ...attachment, signed_url: signed }
    }),
  )

  emailQuery +=
    ' GROUP BY e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature ORDER BY e.sent_at ASC'

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const messages: Message[] = (emailRows || []).map(row => {
    const isFromCustomer = !row.signature && !row.sender_user_id
    return {
      id: row.id,
      subject: row.subject,
      body: row.body,
      signature: row.signature,
      sent_at: row.sent_at,
      isFromCustomer,
      read_at: row.read_at,
      employee_read_at: row.employee_read_at,
      attachments: attachments.filter(attachment => attachment.email_id === row.id),
    }
  })

  return {
    customerName,
    customerEmail,
    messages,
    dealId,
    subject: emailRows?.[0]?.subject || null,
    threadId,
    currentUserSignature,
    companyId: user.company_id ?? 0,
  }
}

export default function EmployeeEmailsChatRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = useLoaderData<typeof loader>()

  return (
    <EmailChat
      variant='employee'
      customerName={data.customerName}
      messages={data.messages}
      onClose={() => navigate(`/employee/emails${location.search}`)}
      dealId={data.dealId}
      subject={data.subject}
      threadId={data.threadId}
      currentUserSignature={data.currentUserSignature}
      customerEmail={data.customerEmail}
      companyId={data.companyId}
    />
  )
}
