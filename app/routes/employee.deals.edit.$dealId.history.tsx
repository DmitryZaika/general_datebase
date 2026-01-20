import {
    type LoaderFunctionArgs,
    Outlet,
    redirect,
    useLoaderData,
    useNavigate,
} from 'react-router'
import { customerColumns } from '~/components/tables/DealEmails'
import { DataTable } from '~/components/ui/data-table'
import { getDealEmailsWithReads } from '~/crud/emails'
import { getEmployeeUser } from '~/utils/session.server'
  
  interface EmailHistory {
    id: number
    thread_id: string
    subject: string
    body: string
    sent_at: string
    read_count: number
  }
  
  export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    try {
      await getEmployeeUser(request)
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
    const handleRowClick = (email: EmailHistory) => {
      navigate(`chat/${email.thread_id}`)
    }
  
    return (
      <>
        <DataTable
          columns={customerColumns}
          data={emails}
          onRowClick={(email: EmailHistory) => handleRowClick(email)}
          rowClassName={() => 'cursor-pointer'}
          getRowId={(email: EmailHistory) => email.thread_id}
        />
        <Outlet />
      </>
    )
  }