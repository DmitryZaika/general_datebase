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

function adminShellMotionKey(pathname: string, search: string): string {
  const dealEdit = /^(\/admin\/deals\/edit\/[^/]+)(?:\/|$)/.exec(pathname)
  if (dealEdit) {
    return `${dealEdit[1]}${search}`
  }
  return `${pathname}${search}`
}

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
