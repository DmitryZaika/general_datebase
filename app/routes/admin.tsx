import { motion } from 'framer-motion'
import type { LoaderFunction, MetaFunction } from 'react-router'
import { Outlet, redirect, useLocation } from 'react-router'
import { getAdminUser } from '~/utils/session.server'

const ADMIN_VIEW_EASE: [number, number, number, number] = [0.2, 0.78, 0.22, 1]

const ADMIN_VIEW_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: ADMIN_VIEW_EASE },
}

function adminListMotionSearch(search: string, omitKeys: readonly string[]): string {
  const params = new URLSearchParams(search)
  for (const key of omitKeys) {
    params.delete(key)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function adminShellMotionKey(pathname: string, search: string): string {
  if (pathname.startsWith('/admin/emails')) {
    return '/admin/emails'
  }
  if (pathname.startsWith('/admin/deals')) {
    return '/admin/deals'
  }
  if (pathname.startsWith('/admin/stones')) {
    return `/admin/stones${adminListMotionSearch(search, ['viewMode'])}`
  }
  if (pathname.startsWith('/admin/faucets')) {
    return `/admin/faucets${search}`
  }
  if (pathname.startsWith('/admin/sinks')) {
    return `/admin/sinks${search}`
  }
  if (pathname.startsWith('/admin/images')) {
    return '/admin/images'
  }
  if (pathname.startsWith('/admin/documents')) {
    return '/admin/documents'
  }
  if (pathname.startsWith('/admin/suppliers')) {
    return '/admin/suppliers'
  }
  if (pathname.startsWith('/admin/supports')) {
    return '/admin/supports'
  }
  if (pathname.startsWith('/admin/transactions')) {
    return '/admin/transactions'
  }
  if (pathname.startsWith('/admin/customers')) {
    return '/admin/customers'
  }
  if (pathname.startsWith('/admin/cloudtalk')) {
    return '/admin/cloudtalk'
  }
  if (pathname.startsWith('/admin/company') || pathname.startsWith('/admin/users')) {
    return '/admin/company-settings'
  }
  return `${pathname}${search}`
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin' }]
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
  const location = useLocation()
  return (
    <motion.div
      key={adminShellMotionKey(location.pathname, location.search)}
      className='w-full min-h-0'
      {...ADMIN_VIEW_ENTER}
    >
      <Outlet />
    </motion.div>
  )
}
