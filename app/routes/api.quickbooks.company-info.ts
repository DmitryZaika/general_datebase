import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { commitSession, getSession } from '~/sessions'
import {
  clearQboSession,
  getQboCompanyInformation,
  getQboTokenState,
  QboTokenState,
  refreshQboToken,
  setQboSession,
} from '~/utils/quickbooks.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie')
  const session = await getSession(cookieHeader)
  const accessToken = session.get('qboAccessToken')
  const realmId = session.get('qboRealmId')
  const refreshToken = session.get('qboRefreshToken')

  if (!realmId || !accessToken || !refreshToken) {
    return data({ success: false })
  }

  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const tokenState = getQboTokenState(session)
  if (tokenState === QboTokenState.ACCESS_VALID) {
    const result = await getQboCompanyInformation(accessToken, realmId)
    if (typeof result === 'object') {
      return result
    }
  }
  if (tokenState === QboTokenState.INVALID) {
    clearQboSession(session)
    return data(
      { success: false },
      {
        headers: {
          'Set-Cookie': await commitSession(session),
        },
      },
    )
  }
  // TODO: fix this
  const refresh = await refreshQboToken(request, 1234567890, refreshToken)
  setQboSession(session, refresh)
  const result = await getQboCompanyInformation(refresh.access_token, realmId)
  if (typeof result === 'number') {
    return data({ success: false })
  }
  return data(result, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  })
}
