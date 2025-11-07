import clsx from 'clsx'
import { Link, useLoaderData, useLocation } from 'react-router'
import { Button } from '~/components/ui/button'
import type { HeaderProps } from '~/types'
import { getCustomerUrl, getMirroredUrl } from '~/utils/headerNav'
import { LinkButton } from '../molecules/LinkButton'
import { TodoList } from '../organisms/TodoList'

interface HeaderDesktopProps extends HeaderProps {
  className: string
}

export function HeaderDesktop({
  user,
  isAdmin,
  isSuperUser,
  className,
}: HeaderDesktopProps) {
  const location = useLocation()
  const isAdminPage = location.pathname.startsWith('/admin')
  const isCustomerPage = location.pathname.startsWith('/customer')
  const data = useLoaderData<{ user: { company_id: number } | null }>()
  const companyId = isCustomerPage
    ? location.pathname.split('/').filter(Boolean)[1]
    : data?.user?.company_id

  const customerSwitchUrl =
    companyId === undefined
      ? '/employee/stones'
      : getCustomerUrl(isCustomerPage, location, companyId)
  return (
    <header
      className={clsx('flex-row items-center   gap-0 justify-between  p-3 ', className)}
    >
      <div className='logo'>
        <a className='flex justify-center' href='/'>
          <img
            src='https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp'
            alt='Logo'
            className='h-12 md:h-16 object-contain'
          />
        </a>
      </div>

      <div className='flex gap-4'>
        {isAdmin || isSuperUser ? (
          isAdminPage ? (
            <div className=' flex gap-4'>
              <Link to={getMirroredUrl(isAdminPage, location)}>
                <LinkButton className='select-none'>Employee</LinkButton>
              </Link>
            </div>
          ) : (
            <Link to={getMirroredUrl(isAdminPage, location)}>
              <LinkButton className='select-none'>Admin</LinkButton>
            </Link>
          )
        ) : null}
        <Link to={customerSwitchUrl}>
          <LinkButton className='select-none'>
            {isCustomerPage ? 'Employee' : 'Customer'}
          </LinkButton>
        </Link>
      </div>
      <nav className='text-center flex-1'>
        <ul className='flex-col md:flex-row flex flex-wrap justify-center ali md:justify-center gap-4'></ul>
      </nav>

      <div className='flex items-center gap-2'>
        {/* <Notification className='relative z-10 mr-20' /> */}
        <TodoList />
      </div>

      {user !== null && (
        <Link to='/logout'>
          <Button>Logout</Button>
        </Link>
      )}
      <div className='flex justify-center md:justify-end w-full md:w-auto'></div>
    </header>
  )
}
