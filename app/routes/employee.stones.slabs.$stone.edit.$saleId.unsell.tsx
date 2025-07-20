import { useMutation } from '@tanstack/react-query'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { useToast } from '~/hooks/use-toast'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.saleId) {
    throw new Error('Sale ID is missing')
  }
  const saleId = parseInt(params.saleId, 10)
  return { saleId }
}

const unsellSale = async (saleId: number) => {
  const response = await fetch(`/api/unsell/${saleId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error('Failed to unsell sale')
  }
  return response.json()
}

export default function Unsell() {
  const { toast } = useToast()

  const { saleId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${window.location.search}`)
    }
  }

  const unsellMutation = useMutation({
    mutationFn: (saleId: number) => {
      return unsellSale(saleId)
    },
  })

  const handleUnsell = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!saleId) return
    unsellMutation.mutate(saleId, {
      onSuccess: () => {
        navigate(`/employee/stones/${window.location.search}`, {
          replace: true,
        })
        toast({
          title: 'Success',
          description: 'Sale unsold',
          variant: 'success',
        })
      },
    })
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Unsell Sale'
      description='Are you sure you want to cancel this sale?'
      onSubmit={handleUnsell}
    />
  )
}
