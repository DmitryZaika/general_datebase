import { type LoaderFunctionArgs, redirect } from 'react-router'
import { type Agent, fetchValue } from '~/utils/cloudtalk.server'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

async function fetchCalls(companyId: number) {
  return await fetchValue<Agent>('agents/index.json', companyId, {})
}

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  return await fetchCalls(user.company_id)
}
