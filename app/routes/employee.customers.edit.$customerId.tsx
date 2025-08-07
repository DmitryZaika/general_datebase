import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const customerId = parseInt(params.customerId || '0')
  try {
    const user = await getEmployeeUser(request)
    return { user, customerId }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function CustomersEdit() {
  const { user, customerId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const onSuccess = () => {
    navigate('..')
  }

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <CustomerForm
      handleChange={handleChange}
      onSuccess={onSuccess}
      companyId={user.company_id}
      customerId={customerId}
      source='user-input'
    />
  )
}
