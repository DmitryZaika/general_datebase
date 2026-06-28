import type { RowDataPacket } from 'mysql2'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
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

const CUSTOMER_EMAIL_MATCH = `(
  LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(sender_email, '<', -1), '>', 1))) = ?
  OR (sender_email NOT LIKE '%<%' AND LOWER(TRIM(sender_email)) = ?)
  OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(receiver_email, '<', -1), '>', 1))) = ?
  OR (receiver_email NOT LIKE '%<%' AND LOWER(TRIM(receiver_email)) = ?)
)`

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const customerId = Number(params.customerId)
  const threadId = params.threadId
  if (!customerId || !threadId) {
    return redirect('/employee/customers')
  }

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT id, name, email FROM customers
     WHERE id = ? AND company_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [customerId, user.company_id],
  )

  if (!customerRows?.length) {
    return redirect('/employee/customers')
  }

  const customerName = customerRows[0].name || 'Customer'
  const customerEmail = parseEmailAddress(customerRows[0].email || '').toLowerCase()
  if (!customerEmail) {
    return redirect(`/employee/customers/info/${customerId}/info`)
  }

  const [threadRows] = await db.execute<RowDataPacket[]>(
    `SELECT 1 FROM emails
     WHERE deleted_at IS NULL
       AND thread_id = ?
       AND ${CUSTOMER_EMAIL_MATCH}
     LIMIT 1`,
    [threadId, customerEmail, customerEmail, customerEmail, customerEmail],
  )

  if (!threadRows?.length) {
    posthogClient.captureException(new Error('Customer email thread not found'))
    return redirect(`/employee/customers/info/${customerId}/info`)
  }

  const [userSignatureRows] = await db.execute<RowDataPacket[]>(
    'SELECT email_signature FROM users WHERE id = ?',
    [user.id],
  )
  const currentUserSignature = userSignatureRows?.[0]?.email_signature || null

  await db.execute(
    `
      UPDATE emails
      SET employee_read_at = NOW()
      WHERE deleted_at IS NULL
        AND thread_id = ?
        AND employee_read_at IS NULL
        AND sender_user_id IS NULL
    `,
    [threadId],
  )

  const emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature as signature, MAX(er.read_at) AS read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
       LEFT JOIN users u ON u.id = e.sender_user_id
      WHERE e.deleted_at IS NULL AND e.thread_id = ?
      GROUP BY e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature
      ORDER BY e.sent_at ASC`

  const emailParams = [threadId]

  const attachmentsRaw = await selectMany<Attachment>(
    db,
    `SELECT id, email_id, content_type, content_subtype, filename, url
     FROM email_attachments
     WHERE email_id IN (
       SELECT id FROM emails WHERE deleted_at IS NULL AND thread_id = ?
     )`,
    [threadId],
  )

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

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const [dealRows] = await db.execute<RowDataPacket[]>(
    'SELECT deal_id FROM emails WHERE thread_id = ? AND deal_id IS NOT NULL LIMIT 1',
    [threadId],
  )
  const dealId = dealRows?.[0]?.deal_id ?? null

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
    customerId,
    customerName,
    customerEmail,
    messages,
    dealId,
    subject: emailRows?.[0]?.subject || null,
    threadId,
    currentUserSignature,
    companyId: user.company_id ?? 0,
    userId: user.id,
  }
}

export default function EmployeeCustomerEmailChatRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const messageIdRaw = searchParams.get('messageId')
  const scrollToMessageId = messageIdRaw !== null ? Number(messageIdRaw) : null

  return (
    <EmailChat
      variant='employee'
      userId={data.userId}
      customerName={data.customerName}
      customerId={data.customerId}
      messages={data.messages}
      onClose={() =>
        navigate(`/employee/customers/info/${data.customerId}/info${location.search}`)
      }
      embedded
      readOnly
      dealId={data.dealId}
      subject={data.subject}
      threadId={data.threadId}
      currentUserSignature={data.currentUserSignature}
      customerEmail={data.customerEmail}
      companyId={data.companyId}
      dealNav={{
        companyId: data.companyId,
        customerEmail: data.customerEmail,
        pathPrefix: 'employee',
        threadDealId: data.dealId,
      }}
      scrollToMessageId={
        scrollToMessageId !== null && Number.isFinite(scrollToMessageId)
          ? scrollToMessageId
          : null
      }
    />
  )
}
