import clsx from 'clsx'
import { Link, useLoaderData, useLocation } from 'react-router'
import { Button } from '~/components/ui/button'
import { defaultLogo, gbColumbus, gbIndianapolis, gmqTops } from '~/constants/logos'
import { useSuperAdminCompanySwitch } from '~/hooks/useSuperAdminCompanySwitch'
import type { HeaderProps } from '~/types'
import { getCustomerUrl, getMirroredUrl } from '~/utils/headerNav'
import { LinkButton } from '../molecules/LinkButton'
import { Notification } from '../molecules/Notification'
import { SuperAdminCompanySelect } from '../molecules/SuperAdminCompanySelect'
import { TodoList } from '../organisms/TodoList'

interface HeaderDesktopProps extends HeaderProps {
  className: string
}

export function HeaderDesktop({
  user,
  isAdmin,
  isSuperUser,
  isSuperAdmin,
  className,
  superadminCompanies = [],
  activeCompanyId,
}: HeaderDesktopProps) {
  const location = useLocation()
  const isAdminPage = location.pathname.startsWith('/admin')
  const isCustomerPage = location.pathname.startsWith('/customer')
  const data = useLoaderData<{ user: { company_id: number } | null }>()
  const companyId = isCustomerPage
    ? location.pathname.split('/').filter(Boolean)[1]
    : (activeCompanyId ?? data?.user?.company_id)
  const id = Number(companyId)
  const companyLogo =
    id === 1 ? gbIndianapolis : id === 3 ? gbColumbus : id === 4 ? gmqTops : defaultLogo

  const customerSwitchUrl =
    companyId === undefined
      ? '/employee/stones'
      : getCustomerUrl(isCustomerPage, location, companyId)

  const { handleCompanySwitch } = useSuperAdminCompanySwitch()

  return (
    <header
      className={
        id === 4
          ? clsx('flex-row items-center   gap-0 justify-between  px-3 py-2', className)
          : clsx('flex-row items-center gap-0 justify-between  px-3', className)
      }
    >
      <div className='logo'>
        <a className='flex justify-center' href='/'>
          <img
            src={companyLogo}
            alt='Logo'
            className={
              id === 4
                ? 'h-12 md:h-16 object-contain mr-4'
                : 'h-16 md:h-24 object-contain'
            }
          />
        </a>
      </div>

      <div className='flex gap-4'>
        {isAdmin || isSuperUser || isSuperAdmin ? (
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
        {isSuperAdmin && superadminCompanies.length > 0 && (
          <SuperAdminCompanySelect
            companies={superadminCompanies}
            activeCompanyId={activeCompanyId}
            currentCompanyId={id}
            onCompanyChange={handleCompanySwitch}
          />
        )}
      </div>
      <nav className='text-center flex-1'>
        <ul className='flex-col md:flex-row flex flex-wrap justify-center ali md:justify-center gap-4'></ul>
      </nav>

      <div className='flex items-center gap-2'>
        <Notification className='relative z-10 mr-3' />
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
