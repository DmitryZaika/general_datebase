import { Link } from 'react-router'
import { Button } from '~/components/ui/button'

interface MarketingHeaderProps {
  companyName?: string
}

export function MarketingHeader({ companyName }: MarketingHeaderProps) {
  return (
    <header className='bg-white flex items-center justify-between p-3'>
      <div className='logo'>
      </div>
      {companyName && (
        <div className='text-center flex-1'>
          <span className='text-sm md:text-base font-medium'>{companyName}</span>
        </div>
      )}
      <div className='flex items-center gap-2'>
        <Link to='/logout' reloadDocument>
          <Button>Logout</Button>
        </Link>
      </div>
    </header>
  )
}
