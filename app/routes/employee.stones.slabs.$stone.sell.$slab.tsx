import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { ContractForm } from '~/components/pages/ContractForm'
import { roomSchema, slabOptionsSchema } from '~/schemas/sales'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { handleSellSlabAction } from '~/utils/sellSlabAction.server'

export async function action({ request }: ActionFunctionArgs) {
  return handleSellSlabAction(request)
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.slab) {
    throw new Error('Slab ID is missing')
  }
  const slabId = parseInt(params.slab, 10)

  return { slabId, companyId: user.company_id }
}

export default function SlabSell() {
  const { slabId, companyId } = useLoaderData<typeof loader>()
  const starting = {
    same_address: true,
    rooms: [
      roomSchema.parse({
        slabs: [
          slabOptionsSchema.parse({
            id: slabId,
            is_full: false,
          }),
        ],
      }),
    ],
  }
  return <ContractForm startings={starting} companyId={companyId} />
}
