import { useMemo } from 'react' // 1. Добавляем useMemo
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation, // Добавляем useLocation, так как он использовался в navigate
  useNavigate,
} from 'react-router'
import {
  customerColumns,
  type DealEmailThreadRow,
} from '~/components/tables/DealEmails'
import { DataTable } from '~/components/ui/data-table'
import { getDealEmailsWithReads } from '~/crud/emails'
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
  const emails = await getDealEmailsWithReads(dealId)

  return { emails }
}

export default function DealEmailHistory() {
  const { emails } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()

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
    navigate(`chat/${email.thread_id}${location.search}`)
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
