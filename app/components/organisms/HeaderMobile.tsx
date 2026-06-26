import { useLoaderData } from 'react-router'
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
import { resolveCompanyLogoHeight, resolveCompanyLogoUrl } from '~/utils/companyLogo'

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
  const data = useLoaderData<{
    user: { company_id: number; is_admin: boolean; is_superuser: boolean } | null
    activeCompanyId?: number
    companyLogoUrl?: string | null
    companyLogoHeight?: number
  }>()
  const companyLogo = resolveCompanyLogoUrl(data?.companyLogoUrl)
  const logoHeight = resolveCompanyLogoHeight(data?.companyLogoHeight)

  return (
    <header className={clsx('flex justify-between', className)}>
      <div className='flex items-center gap-2'>
        <div className='logo'>
          <a className='flex justify-center' href='/'>
            <img
              src={companyLogo}
              alt='Logo'
              className='max-w-full object-contain'
              style={{ height: logoHeight }}
            />
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
