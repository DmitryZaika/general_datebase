import { useMemo } from 'react' // 1. Добавляем useMemo
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import {
  customerColumns,
  type DealEmailThreadRow,
} from '~/components/tables/DealEmails'
import { DataTable } from '~/components/ui/data-table'
import { getDealEmailsWithReads } from '~/crud/emails'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)
  const dealCompanyRows = await selectMany<{ company_id: number }>(
    db,
    `SELECT c.company_id
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )
  if (!dealCompanyRows.length) {
    return redirect('/admin/deals')
  }
  const emails = await getDealEmailsWithReads(dealId, dealCompanyRows[0].company_id)

  return { emails }
}

export default function DealEmailHistory() {
  const { emails } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const uniqueThreads = useMemo(() => {
    const attachmentByThread = new Map<string, boolean>()
    for (const email of emails) {
      if (email.has_attachments) {
        attachmentByThread.set(email.thread_id, true)
      }
    }
    const threadMap = new Map<string, DealEmailThreadRow>()
    for (const email of emails) {
      const existing = threadMap.get(email.thread_id)
      const thread_has_attachments = attachmentByThread.get(email.thread_id) ?? false
      if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
        threadMap.set(email.thread_id, {
          ...email,
          thread_has_attachments,
        })
      }
    }
    return Array.from(threadMap.values())
  }, [emails])

  const handleRowClick = (email: DealEmailThreadRow) => {
    const dealId = params.dealId
    if (!dealId) return
    navigate(
      `/admin/deals/edit/${dealId}/project/chat/${email.thread_id}${location.search}`,
    )
  }

  return (
    <>
      <DataTable
        columns={customerColumns}
        data={uniqueThreads}
        onRowClick={(email: DealEmailThreadRow) => handleRowClick(email)}
        rowClassName={() => 'cursor-pointer'}
        getRowId={(email: DealEmailThreadRow) => email.thread_id}
      />
      <Outlet />
    </>
  )
}
