import type { HeaderProps } from '~/types'
import HeaderCustomers from './organisms/HeaderCustomers'
import { HeaderDesktop } from './organisms/HeaderDesktop'
import { HeaderMobile } from './organisms/HeaderMobile'

export function Header({ user, isEmployee, isAdmin, isSuperUser }: HeaderProps) {
  if (!isEmployee && !isAdmin && !isSuperUser) {
    return <HeaderCustomers />
  }
  return (
    <div className='bg-white'>
      {' '}
      <HeaderDesktop
        className='hidden md:flex'
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
      />
      <HeaderMobile
        className='block md:hidden'
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
      />
    </div>
  )
}
