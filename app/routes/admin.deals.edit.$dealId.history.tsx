import { useMemo } from 'react' // 1. Добавляем useMemo
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation, // Добавляем useLocation, так как он использовался в navigate
  useNavigate,
} from 'react-router'
import { customerColumns } from '~/components/tables/DealEmails'
import { DataTable } from '~/components/ui/data-table'
import { type EmailHistory, getDealEmailsWithReads } from '~/crud/emails'
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
    const threadMap = new Map<string, EmailHistory>()

    emails.forEach(email => {
      const existing = threadMap.get(email.thread_id)

      if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
        threadMap.set(email.thread_id, email)
      }
    })

    return Array.from(threadMap.values())
  }, [emails])

  const handleRowClick = (email: EmailHistory) => {
    navigate(`chat/${email.thread_id}${location.search}`)
  }

  return (
    <>
      <DataTable
        columns={customerColumns}
        data={uniqueThreads}
        onRowClick={(email: EmailHistory) => handleRowClick(email)}
        rowClassName={() => 'cursor-pointer'}
        getRowId={(email: EmailHistory) => email.thread_id}
      />
      <Outlet />
    </>
  )
}
