import { Link, useLoaderData, useLocation, useNavigation } from 'react-router'
import type { HeaderProps } from '~/types'
import { Notification } from '../molecules/Notification'
import { TodoList } from '../organisms/TodoList'

interface HeaderMobileProps extends HeaderProps {
  className: string
}
interface BurgerLinkProps {
  setOpen: (value: boolean) => void
  to: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

import clsx from 'clsx'
import { Menu, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { LinkButton } from '../molecules/LinkButton'

function BurgerLink({ setOpen, to, children, className, onClick }: BurgerLinkProps) {
  const handleClick = () => {
    setOpen(false)
    if (onClick) onClick()
  }

  return (
    <Link
      className={clsx('uppercase text-lg font-bold', className)}
      to={to}
      onClick={handleClick}
    >
      {children}
    </Link>
  )
}

function getMirroredUrl(path: string, search: string) {
  const segments = path.split('/').filter(Boolean)

  if (segments.length >= 2 && segments[0] === 'customer' && segments[2] === 'stones') {
    return `/admin/stones${search}`
  }

  if (segments.length < 1) return `/employee${search}`

  const currentRole = segments[0]
  const targetRole = currentRole === 'admin' ? 'employee' : 'admin'

  if (segments.length < 2) return `/${targetRole}${search}`

  const currentSection = segments[1]

  const supportedSections = [
    'stones',
    'instructions',
    'sinks',
    'faucets',
    'suppliers',
    'supports',
    'documents',
    'images',
  ]
  if (supportedSections.includes(currentSection)) {
    return `/${targetRole}/${currentSection}${search}`
  }

  return `/${targetRole}${search}`
}

export function BurgerMenu({
  user,
  isAdmin,
  isSuperUser,
}: Omit<HeaderMobileProps, 'className'>) {
  const location = useLocation()
  const navigation = useNavigation()
  const isAdminPage = location.pathname.startsWith('/admin')
  const isCustomerPage = location.pathname.startsWith('/customer')
  const [open, setOpen] = useState(false)
  const [isRoleSwitching, setIsRoleSwitching] = useState(false)
  const [isCustomerSwitching, setIsCustomerSwitching] = useState(false)
  const data = useLoaderData<{ user: { company_id: number } | null }>()
  const companyId = data?.user?.company_id || 1

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isRoleSwitching) setIsRoleSwitching(false)
      if (isCustomerSwitching) setIsCustomerSwitching(false)
    }
  }, [navigation.state])

  const targetPath = getMirroredUrl(location.pathname, location.search)

  const getCustomerUrl = () => {
    // Если переходим из admin/stones в customer/:company/stones, сохраняем фильтры
    if (!isCustomerPage && location.pathname.startsWith('/admin/stones')) {
      return `/customer/${companyId}/stones${location.search}`
    }

    return isCustomerPage
      ? `/employee/stones${location.search}`
      : `/customer/${companyId}/stones${location.search}`
  }

  const handleRoleSwitchClick = () => {
    setIsRoleSwitching(true)
  }

  const handleCustomerSwitchClick = () => {
    setIsCustomerSwitching(true)
  }

  return (
    <>
      <Button
        variant='ghost'
        onClick={() => setOpen(true)}
        className='p-6'
        aria-label='Open menu'
      >
        <Menu style={{ width: '25px', height: '25px' }} />
      </Button>

      {open && (
        <div
          role='button'
          aria-label='Close menu overlay'
          tabIndex={0}
          onClick={() => setOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setOpen(false)
          }}
          className='fixed inset-0 z-40 bg-black/50'
        />
      )}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300',
          {
            'translate-x-0': open,
            'translate-x-full': !open,
          },
        )}
      >
        <div className='p-4'>
          <Button
            variant='ghost'
            onClick={() => setOpen(false)}
            className='absolute top-1 right-1'
            aria-label='Закрыть меню'
          >
            <X className='' style={{ width: '25px', height: '25px' }} />
          </Button>

          <nav className='flex flex-col space-y-2 pt-1'>
            <a
              href='/'
              aria-label='Home'
              className='uppercase text-lg font-bold sr-only'
            >
              Home
            </a>
            <div className='flex gap-1'>
              {isAdmin || isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink
                    to={targetPath}
                    className='pb-10'
                    setOpen={setOpen}
                    onClick={handleRoleSwitchClick}
                  >
                    <LinkButton className='select-none'>Employee</LinkButton>
                  </BurgerLink>
                ) : (
                  <BurgerLink
                    to={targetPath}
                    className='pb-2'
                    setOpen={setOpen}
                    onClick={handleRoleSwitchClick}
                  >
                    <LinkButton className='select-none'>Admin</LinkButton>
                  </BurgerLink>
                )
              ) : null}
              <BurgerLink
                to={getCustomerUrl()}
                setOpen={setOpen}
                onClick={handleCustomerSwitchClick}
              >
                <LinkButton className='select-none'>
                  {isCustomerPage ? 'Employee' : 'Customer'}
                </LinkButton>
              </BurgerLink>
              {isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink to='/admin/users' setOpen={setOpen}>
                    <Button>Users</Button>
                  </BurgerLink>
                ) : null
              ) : null}
            </div>

            {user !== null && (
              <BurgerLink to='/logout' className='pt-2' setOpen={setOpen}>
                <Button>Logout</Button>
              </BurgerLink>
            )}
          </nav>
        </div>
      </div>
    </>
  )
}

export function HeaderMobile({
  user,
  isAdmin,
  isSuperUser,
  className,
}: HeaderMobileProps) {
  return (
    <header className={clsx('flex justify-between', className)}>
      <div className='logo'>
        <a className='flex justify-center' href='/'>
          <img
            src='https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp'
            alt='Logo'
            className='h-12 md:h-16 object-contain'
          />
        </a>
      </div>
      <div className='flex items-center gap-2'>
        <Notification />
        <TodoList />
      </div>
      <BurgerMenu user={user} isAdmin={isAdmin} isSuperUser={isSuperUser}></BurgerMenu>
    </header>
  )
}
