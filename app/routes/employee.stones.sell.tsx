import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { ContractForm } from '~/components/pages/ContractForm'
import { roomSchema, type TCustomerSchema } from '~/schemas/sales'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Error', 'Unsupported action', 'destructive'))
  return redirect('..', { headers: { 'Set-Cookie': await commitSession(session) } })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return { companyId: user.company_id }
}

export default function SellNoStone() {
  const { companyId } = useLoaderData<typeof loader>()
  const starting: Partial<TCustomerSchema> = {
    rooms: [
      roomSchema.parse({
        slabs: [],
      }),
    ],
  }
  return <ContractForm startings={starting} companyId={companyId} />
}
