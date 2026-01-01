import { type LoaderFunctionArgs, redirect } from 'react-router'
import { z } from 'zod'
import { BASE_URL, getAuthString } from '~/utils/cloudtalk.server'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

const userIdSchema = z.int().positive()

async function fetchCallMedia(
  callId: number,
  companyId: number,
): Promise<string> {
  const auth = getAuthString(companyId)

  const fullUrl = `${BASE_URL}/calls/recordings/${callId}`

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`CloudTalk API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const userId = userIdSchema.parse(params.callId)
  return fetchCallMedia(user.company_id, userId)
}
