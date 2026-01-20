import { useQuery } from '@tanstack/react-query'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { CustomerForm } from '~/components/pages/CustomerForm'
import type { CustomerDialogSchema } from '~/schemas/customers'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'

const getCustomerInfo = async (customerId: number): Promise<CustomerDialogSchema> => {
  const response = await fetch(`/api/customers/${customerId}`)
  const data = await response.json()
  const rawSource = data.customer.source
  const mappedSource = rawSource === 'user-input' ? 'other' : rawSource
  return {
    name: data.customer.name,
    email: data.customer.email ?? '',
    phone: data.customer.phone ?? '',
    phone_2: data.customer.phone_2 ?? '',
    address: data.customer.address ?? '',
    company_name: data.customer.company_name,
    source: mappedSource,
    your_message: data.customer.your_message ?? '',
    builder: !!data.customer.company_name,
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const customerId = parseInt(params.customerId || '0')
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return { user, customerId, nonce: uuidv4() }
}

export default function CustomersEdit() {
  const { user, customerId, nonce } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()

  const { data } = useQuery({
    queryKey: ['customer', customerId, nonce],
    queryFn: () => getCustomerInfo(customerId || 0),
    enabled: !!customerId,
  })

  const onSuccess = () => {
    navigate(`..${location.search}`)
  }

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }
  if (data === undefined) {
    return null
  }

  return (
    <CustomerForm
      handleChange={handleChange}
      onSuccess={onSuccess}
      companyId={user.company_id}
      customerId={customerId}
      oldData={data}
    />
  )
}
