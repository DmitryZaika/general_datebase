import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { handleAuthError } from '~/utils/apiResponse.server'
import { getUnreadThreadCountForUser } from '~/utils/cloudtalkSmsService.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const count = await getUnreadThreadCountForUser(user)
    return data({ count })
  } catch (err) {
    return handleAuthError(err)
  }
}
