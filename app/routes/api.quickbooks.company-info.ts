import { getSession, commitSession } from '~/sessions';
import { LoaderFunctionArgs, redirect, data } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { setQboSession, getQboTokenState, QboTokenState, clearQboSession, getQboCompanyInformation, refreshQboToken } from "~/utils/quickbooks.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const session = await getSession(cookieHeader);
  const accessToken = session.get('qboAccessToken');
  const realmId = session.get('qboRealmId');
  const refreshToken = session.get('qboRefreshToken');

  console.log(realmId, accessToken, refreshToken);

  if (!realmId || !accessToken || !refreshToken) {
    return data({ success: false })
  }
  console.log("HERE")

  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  console.log("USER", user);

  const tokenState = getQboTokenState(session)
  if (tokenState === QboTokenState.ACCESS_VALID) {
    const result = await getQboCompanyInformation(accessToken, realmId);
    if (typeof result === 'object') {
      return result
    }
  }
  if (tokenState === QboTokenState.INVALID) {
    clearQboSession(session);
    return data({ success: false }, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }
  const refresh = await refreshQboToken(request, user.company_id, refreshToken); 
  setQboSession(session, refresh);
  const result = await getQboCompanyInformation(refresh.access_token, realmId);
  if (typeof result === 'number') {
    return data({ success: false })
  }
  return data(result, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  })
}
