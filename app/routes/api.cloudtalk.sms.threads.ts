import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { handleAuthError } from '~/utils/apiResponse.server'
import { listThreadsForUser } from '~/utils/cloudtalkSmsService.server'
import { clampInt } from '~/utils/phone'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').slice(0, 100)
    const limit = clampInt(Number(url.searchParams.get('limit') ?? '20'), 1, 100)
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'))
    const result = await listThreadsForUser({ user, search, limit, offset })
    return data(result)
  } catch (err) {
    return handleAuthError(err)
  }
}
