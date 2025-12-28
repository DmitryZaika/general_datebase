import type { LoaderFunctionArgs } from 'react-router'
import { Outlet, redirect } from 'react-router'
import { getShopWorkerUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getShopWorkerUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const url = new URL(request.url)
  if (url.pathname === '/shop' || url.pathname === '/shop/') {
    return redirect('/shop/transactions')
  }
  return null
}

export default function Shop() {
  return <Outlet />
}
