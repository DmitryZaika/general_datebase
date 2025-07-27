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
import { customerSchema, type TCustomerSchema } from '~/schemas/sales'
import { commitSession, getSession } from '~/sessions'
import { getCustomerSchemaFromSaleId } from '~/utils/contractsBackend.server'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const resolver = zodResolver(customerSchema)

export async function action({ request, params }: ActionFunctionArgs) {
  // ------------------------------------------------------------
  // Edit existing sale logic (replaces old create-sale action)
  // ------------------------------------------------------------

  // 1. Auth & CSRF
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

  // 2. Parse & validate form data
  const { errors, data, receivedValues } = await getValidatedFormData<TCustomerSchema>(
    request,
    resolver,
  )

  if (errors) {
    return { errors, receivedValues }
  }

  if (!params.saleId) {
    return { error: 'Sale ID is missing' }
  }

  const saleId = Number(params.saleId)
  if (Number.isNaN(saleId)) {
    return { error: 'Invalid Sale ID' }
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

  const contract = new Contract(data, saleId)
  await contract.edit(user)

  // Success toast & redirect
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sale updated successfully'))

  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.saleId) {
    throw new Error('Sale ID is missing')
  }
  const saleId = parseInt(params.saleId, 10)

  const starting = await getCustomerSchemaFromSaleId(saleId)
  if (!starting) {
    return redirect(`/employee/stones/slabs`)
  }

  return { saleId, starting, companyId: user.company_id }
}

export default function SlabEdit() {
  const data = useLoaderData<typeof loader>()
  const starting = customerSchema.parse(data.starting)

  return (
    <ContractForm starting={starting} saleId={data.saleId} companyId={data.companyId} />
  )
}
