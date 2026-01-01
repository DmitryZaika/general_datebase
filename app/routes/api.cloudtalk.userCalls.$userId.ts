import { type LoaderFunctionArgs, redirect } from 'react-router'
import { z } from 'zod'
import { type Calls200Response, fetchValue } from '~/utils/cloudtalk.server'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

const userIdSchema = z.int().positive()

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

  const userId = userIdSchema.parse(params.userId)
  return fetchCalls(user.company_id, userId)
}
