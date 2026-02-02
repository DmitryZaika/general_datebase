import { useLoaderData, useLocation } from 'react-router'
import type { HeaderProps } from '~/types'
import { Notification } from '../molecules/Notification'
import { TodoList } from '../organisms/TodoList'

interface HeaderMobileProps extends HeaderProps {
  className: string
}

import clsx from 'clsx'
import { Menu } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useSidebar } from '~/components/ui/sidebar'
import { defaultLogo, gbColumbus, gbIndianapolis, gmqTops } from '~/constants/logos'

export function BurgerMenu() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant='ghost'
      onClick={toggleSidebar}
      className='p-6'
      aria-label='Open menu'
    >
      <Menu style={{ width: '25px', height: '25px' }} />
    </Button>
  )
}

export function HeaderMobile({ className }: HeaderMobileProps) {
  const location = useLocation()
  const isCustomerPage = location.pathname.startsWith('/customer')
  const data = useLoaderData<{
    user: { company_id: number; is_admin: boolean; is_superuser: boolean } | null
  }>()
  const companyId = isCustomerPage
    ? location.pathname.split('/').filter(Boolean)[1]
    : data?.user?.company_id
  const id = Number(companyId)
  const companyLogo =
    id === 1 ? gbIndianapolis : id === 3 ? gbColumbus : id === 4 ? gmqTops : defaultLogo

  return (
    <header className={clsx('flex justify-between', className)}>
      <div className='flex items-center gap-2'>
        <div className='logo'>
          <a className='flex justify-center' href='/'>
            <img src={companyLogo} alt='Logo' className='h-18 md:h-16 object-contain' />
          </a>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Notification />
        <TodoList />
      </div>
      <BurgerMenu />
    </header>
  )
}
