import { motion } from 'framer-motion'
import { type LoaderFunctionArgs, redirect, useLocation } from 'react-router'
import { CustomersListPage } from '~/components/views/CustomersListPage'
import { loadCustomersListPage } from '~/utils/customersListLoader.server'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { id: number; company_id: number; is_admin: boolean }
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return loadCustomersListPage(request, user)
}

const EMPLOYEE_VIEW_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.2, 0.78, 0.22, 1] as const },
}

function employeeCustomersMotionKey(search: string) {
  const params = new URLSearchParams(search)
  return [
    params.get('tab') ?? 'walkin',
    params.get('view') ?? 'customers',
    params.get('page') ?? '1',
    params.get('pageSize') ?? '100',
    params.get('sales_rep') ?? '',
    params.get('show_invalid') ?? '',
  ].join('|')
}

export default function EmployeeCustomers() {
  const location = useLocation()
  return (
    <motion.div
      key={employeeCustomersMotionKey(location.search)}
      className='w-full'
      {...EMPLOYEE_VIEW_ENTER}
    >
      <CustomersListPage />
    </motion.div>
  )
}
