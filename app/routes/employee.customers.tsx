import { motion } from 'framer-motion'
import { type LoaderFunctionArgs, type MetaFunction, redirect } from 'react-router'
import { CustomersListPage } from '~/components/views/CustomersListPage'
import { loadCustomersListPage } from '~/utils/customersListLoader.server'
import { EMPLOYEE_VIEW_ENTER } from '~/utils/employeeViewEnterMotion'
import { getEmployeeUser } from '~/utils/session.server'

export const meta: MetaFunction = () => {
  return [{ title: 'Customers' }]
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { id: number; company_id: number; is_admin: boolean }
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return loadCustomersListPage(request, user)
}

export default function EmployeeCustomers() {
  return (
    <motion.div className='w-full' {...EMPLOYEE_VIEW_ENTER}>
      <CustomersListPage />
    </motion.div>
  )
}
