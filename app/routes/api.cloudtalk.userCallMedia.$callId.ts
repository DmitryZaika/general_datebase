import { type LoaderFunctionArgs, redirect } from 'react-router'
import { z } from 'zod'
import { fetchValueRaw } from '~/utils/cloudtalk.server'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

const callIdSchema = z.coerce.number().int().positive()

async function fetchCallMedia(callId: number, companyId: number): Promise<Response> {
  return await fetchValueRaw(`calls/recording/${callId}.json`, companyId, {})
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const callId = callIdSchema.parse(params.callId)
  return await fetchCallMedia(callId, user.company_id)
}
