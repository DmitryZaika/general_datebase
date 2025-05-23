import { getSession, commitSession } from '~/sessions';
import { LoaderFunctionArgs, redirect, data, ActionFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getEmployeeUser } from "~/utils/session.server";
import { getQboToken, setQboSession, getQboTokenState, QboTokenState, clearQboSession, queryQboCustomersByContact, refreshQboToken, createQboCustomer } from "~/utils/quickbooks.server";
import { toastData } from "~/utils/toastHelpers";

export async function loader({ request }: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;
  const phone = searchParams.get("phone") ?? undefined;
  const cookieHeader = request.headers.get('Cookie');
  const session = await getSession(cookieHeader);
  const accessToken = session.get('qboAccessToken');
  const realmId = session.get('qboRealmId');
  const refreshToken = session.get('qboRefreshToken');

  if (!realmId || !accessToken || !refreshToken) {
    return data({ success: false })
  }

  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const tokenState = getQboTokenState(session)
  if (tokenState === QboTokenState.ACCESS_VALID) {
    const result = await queryQboCustomersByContact(accessToken, realmId, email, phone);
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
  const result = await queryQboCustomersByContact(refresh.access_token, realmId, email, phone);
  if (typeof result === 'number') {
    return data({ success: false })
  }
  return data(result, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  })
}


export async function action({ request }: ActionFunctionArgs) {
  // ---------- 1. достаём токены из cookie ----------
  const cookieHeader = request.headers.get("Cookie");
  const session = await getSession(cookieHeader);
  const accessToken = session.get("qboAccessToken");
  const realmId = session.get("qboRealmId");
  const refreshToken = session.get("qboRefreshToken");

  if (!realmId || !accessToken || !refreshToken) {
    return data({ success: false });
  }

  // ---------- 2. авторизованный сотрудник ----------
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  let payload: {
    name: string;
    email: string;
    phone: string;
    address: Record<string, unknown>;
  };
  try {
    payload = await request.json();
  } catch {
    return data({ success: false, message: "Неверный JSON" }, { status: 400 });
  }

  const { name, email, phone, address } = payload;
  if (!name) {
    return data({ success: false, message: "Поле name обязательно" }, { status: 400 });
  }

  // ---------- 4. проверяем / обновляем токен ----------
  const tokenState = getQboTokenState(session);

  let at = accessToken;      // актуальный access‑token
  if (tokenState === QboTokenState.INVALID) {
    clearQboSession(session);
    return data({ success: false }, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } else if (tokenState === QboTokenState.REFRESH_VALID) {
    const refresh = await refreshQboToken(request, user.company_id, refreshToken);
    setQboSession(session, refresh);
    at = refresh.access_token;
  }

  // ---------- 5. создаём клиента ----------
  try {
    const customer = await createQboCustomer(at, realmId, name, email, phone, address);
    return data({ success: true, customer }, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (err: any) {
    return data({ success: false, message: String(err) }, { status: 500 });
  }
}
