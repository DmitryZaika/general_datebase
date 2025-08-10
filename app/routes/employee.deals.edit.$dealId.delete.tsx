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

  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)
  return { dealId }
}

const deleteDeal = async (dealId: number) => {
  const response = await fetch(`/api/delete-deal/${dealId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error('Failed to delete deal')
  }
  return response.json()
}

export default function DeleteDeal() {
  const { toast } = useToast()

  const { dealId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${window.location.search}`)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (dealId: number) => {
      return deleteDeal(dealId)
    },
  })

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!dealId) return
    deleteMutation.mutate(dealId, {
      onSuccess: () => {
        navigate(`/employee/deals`, {
          replace: true,
        })
        toast({
          title: 'Success',
          description: 'Deal deleted',
          variant: 'success',
        })
      },
    })
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete Deal'
      description='Are you sure you want to delete this deal?'
      onSubmit={handleDelete}
    />
  )
}
