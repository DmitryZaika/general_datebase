import { useMutation } from '@tanstack/react-query'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { useToast } from '~/hooks/use-toast'
import { type CustomerDialogSchema, createCustomerMutation } from '~/schemas/customers'
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
  const toast = useToast()
  const { user } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const onSuccess = () => {
    navigate('..')
  }

  const mutation = useMutation(createCustomerMutation(toast, onSuccess))

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  const onSubmit = (data: CustomerDialogSchema) => {
    mutation.mutate({ ...data, company_id: user.company_id })
  }

  return (
    <CustomerForm
      handleChange={handleChange}
      onSubmit={onSubmit}
      isLoading={mutation.isPending}
    />
  )
}
