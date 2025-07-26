import { zodResolver } from '@hookform/resolvers/zod'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  data as routerData,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { ContractForm } from '~/components/pages/ContractForm'
import { Contract } from '~/orm/contract'
import {
  customerSchema,
  roomSchema,
  slabOptionsSchema,
  type TCustomerSchema,
} from '~/schemas/sales'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const resolver = zodResolver(customerSchema)

export async function action({ request, params }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const { errors, data, receivedValues } = await getValidatedFormData<TCustomerSchema>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }

  const slabId = params.slab
  if (!slabId) {
    return { error: 'Slab ID is missing' }
  }
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  for (const room of data.rooms) {
    if (room.slabs.length === 0) {
      const session = await getSession(request.headers.get('Cookie'))
      session.flash(
        'message',
        toastData('Error', 'At least one slab is required in each room', 'destructive'),
      )
      return routerData(
        {
          errors: {
            rooms: {
              _errors: ['At least one slab is required in each room'],
            },
          },
        },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    }
  }
  const contract = new Contract(data)
  await contract.sell(user)

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sale completed successfully'))

  const separator = searchString ? '&' : '?'
  return redirect(`..${searchString}${separator}saleId=${contract.saleId}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.slab) {
    throw new Error('Slab ID is missing')
  }
  const slabId = parseInt(params.slab, 10)

  return { slabId }
}

export default function SlabSell() {
  const { slabId } = useLoaderData<typeof loader>()
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
  return <ContractForm starting={starting} />
}
