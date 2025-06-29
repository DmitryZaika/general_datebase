import type { LoaderFunction, MetaFunction } from 'react-router'
import { useLocation, useNavigate, Outlet } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { redirect } from 'react-router'
import { getAdminUser } from '~/utils/session.server'

export const meta: MetaFunction = () => {
  return [
    { title: 'Granite Depot Database' },
    { name: 'description', content: 'Welcome to Remix!' },
  ]
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const url = new URL(request.url)
  if (['/admin', '/admin/'].includes(url.pathname)) {
    return redirect('/admin/stones')
  }
  return null
}

export default function Admin() {
  return <Outlet />
}
