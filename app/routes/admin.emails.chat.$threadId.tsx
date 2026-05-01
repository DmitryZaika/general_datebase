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
import { getAdminUser, type User } from '~/utils/session.server'
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
    user = await getAdminUser(request)
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

  const trashChat = new URL(request.url).searchParams.get('folder') === 'trash'
  const deletedFilterRow = trashChat
    ? 'e.deleted_at IS NOT NULL'
    : 'e.deleted_at IS NULL'
  const deletedFilterSub = trashChat ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'

  const [dealRows] = await db.execute<RowDataPacket[]>(
    'SELECT deal_id FROM emails WHERE thread_id = ? AND deal_id IS NOT NULL LIMIT 1',
    [threadId],
  )

  const dealId = dealRows?.[0]?.deal_id || null

  const normalizeEmail = (email: string | null | undefined) =>
    parseEmailAddress(email).toLowerCase() || ''

  let customerName = 'Customer'
  let customerEmail = ''

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
  } else {
    // Try to find customer from email thread participants
    const [threadEmails] = await db.execute<RowDataPacket[]>(
      `SELECT sender_email, receiver_email FROM emails WHERE thread_id = ? LIMIT 1`,
      [threadId],
    )

    if (threadEmails && threadEmails.length > 0) {
      const { sender_email, receiver_email } = threadEmails[0]
      const sEmail = normalizeEmail(sender_email)
      const rEmail = normalizeEmail(receiver_email)

      // Try to find customer by sender email
      const [custSender] = await db.execute<RowDataPacket[]>(
        `SELECT id, name, email FROM customers WHERE email = ?`,
        [sEmail],
      )

      if (custSender && custSender.length > 0) {
        customerName = custSender[0].name
        customerEmail = normalizeEmail(custSender[0].email)
      } else {
        // Try to find customer by receiver email
        const [custReceiver] = await db.execute<RowDataPacket[]>(
          `SELECT id, name, email FROM customers WHERE email = ?`,
          [rEmail],
        )

        if (custReceiver && custReceiver.length > 0) {
          customerName = custReceiver[0].name
          customerEmail = normalizeEmail(custReceiver[0].email)
        } else {
          // Fallback: assume the one that is NOT the current user's email is the customer
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

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature as signature, MAX(er.read_at) AS read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
       LEFT JOIN users u ON u.id = e.sender_user_id
      WHERE ${deletedFilterRow} AND e.thread_id = ?`
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
       WHERE ${deletedFilterSub} AND thread_id = ?`
  const attachParams: (number | string)[] = [threadId]

  if (dealId) {
    attachQuery += ` AND (deal_id = ? OR deal_id IS NULL)`
    attachParams.push(dealId)
  }
  attachQuery += ` )`

  const attachmentsRaw = await selectMany<Attachment>(db, attachQuery, attachParams)
  const attachments = await Promise.all(
    attachmentsRaw.map(async attachment => {
      const type = attachment.content_type.trim().toLowerCase()
      const subtype = attachment.content_subtype.trim().toLowerCase()
      const mime = type && subtype ? `${type}/${subtype}` : null
      const signed = await presignIfS3Uri(attachment.url, 3600, 'inline', mime)
      if (signed === attachment.url) return attachment
      return { ...attachment, signed_url: signed }
    }),
  )

  emailQuery +=
    ' GROUP BY e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature ORDER BY e.sent_at ASC'

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const messages: Message[] = (emailRows || []).map(row => {
    // If it's not from an employee (no signature and no sender_user_id), it's from the customer
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

export default function AdminEmailsChatRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = useLoaderData<typeof loader>()

  return (
    <EmailChat
      variant='admin'
      customerName={data.customerName}
      messages={data.messages}
      onClose={() => navigate(`/admin/emails${location.search}`)}
      dealNav={{
        companyId: data.companyId,
        customerEmail: data.customerEmail,
        pathPrefix: 'admin',
        threadDealId: data.dealId,
      }}
    />
  )
}
