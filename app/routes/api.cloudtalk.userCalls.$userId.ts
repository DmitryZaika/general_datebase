import { type LoaderFunctionArgs, redirect } from 'react-router'
import { type Calls200Response, fetchValue } from '~/utils/cloudtalk.server'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

function send422(value: string) {
  throw new Response(null, {
    status: 422,
    statusText: value,
  })
}

async function fetchCalls(companyId: number, userId: number) {
  const params = { user_id: userId }
  return await fetchValue<Calls200Response>('calls/index.json', companyId, params)
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.userId) {
    return send422('Missing user ID')
  }
  const userId = parseInt(params.userId, 10)
  return await fetchCalls(user.company_id, userId)
}
