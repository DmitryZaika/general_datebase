import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    return { user }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function CustomersAdd() {
  const { user } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const onSuccess = () => {
    navigate(`..${location.search}`)
  }

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }

  return (
    <CustomerForm
      handleChange={handleChange}
      onSuccess={onSuccess}
      companyId={user.company_id}
    />
  )
}
