import { type LoaderFunctionArgs, redirect } from 'react-router'
import { CustomersListPage } from '~/components/views/CustomersListPage'
import { loadCustomersListPage } from '~/utils/customersListLoader.server'
import { getAdminUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { id: number; company_id: number; is_admin: boolean }
  try {
    const sessionUser = await getAdminUser(request)
    user = {
      id: sessionUser.id,
      company_id: sessionUser.company_id,
      is_admin: sessionUser.is_admin,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return loadCustomersListPage(request, user)
}

export default function AdminCustomers() {
  return <CustomersListPage />
}
