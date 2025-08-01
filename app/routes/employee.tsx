import type { LoaderFunction, MetaFunction } from 'react-router'
import { Outlet, redirect } from 'react-router'
import { getEmployeeUser } from '~/utils/session.server'

export const meta: MetaFunction = () => {
  return [
    { title: 'Granite Depot Database' },
    { name: 'description', content: 'Welcome to Remix!' },
  ]
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getEmployeeUser(request)
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
