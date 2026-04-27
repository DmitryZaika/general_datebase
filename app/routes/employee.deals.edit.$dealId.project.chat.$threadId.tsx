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
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)
  const threadId = params.threadId
  if (!threadId) {
    posthogClient.captureException(new Error('Thread ID is missing'))
    throw new Error('Thread ID is missing')
  }

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email, d.customer_id
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const normalizeEmail = (email: string | null | undefined) =>
    parseEmailAddress(email).toLowerCase() || ''
  const customerEmail = normalizeEmail(customerRows?.[0]?.email || '')

  await db.execute(
    `
      UPDATE emails
      SET employee_read_at = NOW()
      WHERE deleted_at IS NULL
        AND thread_id = ?
        AND (deal_id = ? OR deal_id IS NULL)
        AND employee_read_at IS NULL
        AND sender_user_id IS NULL
    `,
    [threadId, dealId],
  )

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, e.sender_user_id, u.email_signature as signature, MAX(er.read_at) AS read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
       LEFT JOIN users u ON u.id = e.sender_user_id
      WHERE e.deleted_at IS NULL AND e.thread_id = ? AND (e.deal_id = ? OR e.deal_id IS NULL)`
  const emailParams: (number | string)[] = [threadId, dealId]

  const attachmentsRaw = await selectMany<Attachment>(
    db,
    `SELECT id, email_id, content_type, content_subtype, filename, url
     FROM email_attachments
     WHERE email_id IN (
       SELECT id
       FROM emails
       WHERE deleted_at IS NULL AND thread_id = ? AND (deal_id = ? OR deal_id IS NULL)
     )`,
    [threadId, dealId],
  )
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
    customerName: customerRows?.[0]?.name || 'Customer',
    customerEmail,
    messages,
    dealId,
    subject: emailRows?.[0]?.subject || null,
    threadId,
    currentUserSignature,
    companyId: user.company_id ?? 0,
  }
}

export default function EmployeeDealsProjectChatRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const messageIdRaw = searchParams.get('messageId')
  const scrollToMessageId = messageIdRaw !== null ? Number(messageIdRaw) : null

  return (
    <EmailChat
      variant='employee'
      customerName={data.customerName}
      messages={data.messages}
      onClose={() =>
        navigate(`/employee/deals/edit/${data.dealId}/project${location.search}`)
      }
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
