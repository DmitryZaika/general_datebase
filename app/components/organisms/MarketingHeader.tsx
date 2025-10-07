import { Link, useLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'

export function MarketingHeader() {
  const { companyName } = useLoaderData<{ companyName: string | null }>()

  return (
    <header className='bg-white flex items-center justify-between p-3'>
      <div className='logo'>
        <a className='flex justify-center' href='/'>
          <img
            src='https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp'
            alt='Logo'
            className='h-12 md:h-16 object-contain'
          />
        </a>
      </div>
      <div className='text-center flex-1'>
        <span className='text-sm md:text-base font-medium'>{companyName ?? ''}</span>
      </div>
      <div className='flex items-center gap-2'>
        <Link to='/logout' reloadDocument>
          <Button>Logout</Button>
        </Link>
      </div>
    </header>
  )
}
