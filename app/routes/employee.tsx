import type { LoaderFunction, MetaFunction } from 'react-router'
import { Outlet, redirect } from 'react-router'
import { db } from '~/db.server'
import { Positions } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export const meta: MetaFunction = () => {
  return [
    { title: 'Granite Depot Database' },
    { name: 'description', content: 'Welcome to Remix!' },
  ]
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const user = await getEmployeeUser(request)
    const positions = await selectMany<{ position_id: number }>(
      db,
      'SELECT position_id FROM users_positions WHERE user_id = ?',
      [user.id],
    )
    const isShopWorker = positions.some(p => p.position_id === Positions.ShopWorker)
    if (isShopWorker) {
      return redirect('/shop/transactions')
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const url = new URL(request.url)
  if (['/employee', '/employee/'].includes(url.pathname)) {
    return redirect('/employee/stones')
  }
  return null
}

export default function Employee() {
  return <Outlet />
}
