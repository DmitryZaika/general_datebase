//// filepath: c:\Users\sarah\general_datebase\app\components\organisms\HeaderCustomers.tsx
import { type Location, Link, useLocation, useNavigation } from 'react-router'
import { LoadingButton } from '../molecules/LoadingButton'

function getButtonLink({ location, companyId }: { location: Location, companyId: string }) {
  const viewId = typeof window !== 'undefined' ? window.localStorage.getItem('customerViewId') : null
  if (viewId && location.pathname.includes('stones')) {
    return `/customer/${companyId}/${viewId}`
  } else if (!viewId && location.pathname.includes('stones')) {
    return `/customer/${companyId}/stones/account${location.search}`
  }
  return `/customer/${companyId}/stones${location.search}`
}

export default function HeaderCustomers() {
  const location = useLocation()
  const isLogin = location.pathname.includes('login')
  const segments = location.pathname.split('/').filter(Boolean)
  const companyId = segments[1]
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const logoUrl = isLogin
    ? 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/GM-icon-bezfona.png'
    : Number(companyId) === 4
        ? 'https://gmqtops.com/wp-content/uploads/2023/01/logo-b.png'
        : 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp'
  const viewId = segments[0] === 'customer' && segments.length >= 3 ? segments[2] : ''
  const isStonesView = viewId === 'stones'
  const buttonLink = getButtonLink({ location, companyId })
  return (
    <>
      <header className='flex justify-between items-center p-4'>
        {!isLogin && (
          <Link to={buttonLink}>
            <LoadingButton loading={loading}>
              {isStonesView ? 'Customer Account' : 'Stones'}
            </LoadingButton>
          </Link>
        )}
        <div className='flex-1 flex justify-center'>
          <a href={isLogin ? '/' : 'stones'}>
            <img
              src={logoUrl}
              alt='Logo'
              className={isLogin ? 'h-36 md:h-36 object-contain' : 'h-12 md:h-16 object-contain'}
            />
          </a>
        </div>
      </header>
    </>
  )
}
