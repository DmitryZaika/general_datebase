import { Link, type Location, useLocation, useNavigation } from 'react-router'
import {
  defaultLogo,
  gbColumbus,
  gbIndianapolis,
  gmqTops,
  loginLogo,
} from '~/constants/logos'
import { LoadingButton } from '../molecules/LoadingButton'
import { BurgerMenu } from './HeaderMobile'

function getButtonLink({
  location,
  companyId,
}: {
  location: Location
  companyId: string
}) {
  const viewId =
    typeof window !== 'undefined' ? window.localStorage.getItem('customerViewId') : null
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
  const isCustomersCompanies = location.pathname === '/customers/companies'
  const segments = location.pathname.split('/').filter(Boolean)
  const companyId = segments[1]
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const id = Number(companyId)
  const logoUrl = isLogin
    ? loginLogo
    : id === 1
      ? gbIndianapolis
      : id === 3
        ? gbColumbus
        : id === 4
          ? gmqTops
          : defaultLogo
  const viewId = segments[0] === 'customer' && segments.length >= 3 ? segments[2] : ''
  const isStonesView = viewId === 'stones'
  const buttonLink = getButtonLink({ location, companyId })
  const isSurvey = location.pathname.includes('survey')
  const showStonesButton = !isLogin && !isSurvey && !isCustomersCompanies
  const logoSizeClass =
    isLogin || isCustomersCompanies
      ? 'h-36 md:h-44 object-contain'
      : 'h-12 md:h-16 object-contain'
  return (
    <header className='flex justify-between items-center'>
      <div className='flex items-center gap-2'>
        <div className='md:hidden'></div>
        {showStonesButton && (
          <Link to={buttonLink}>
            <LoadingButton loading={loading}>
              {isStonesView ? 'Customer Account' : 'Stones'}
            </LoadingButton>
          </Link>
        )}
      </div>
      <div className='flex-1 flex justify-center'>
        {isCustomersCompanies ? (
          <img src={logoUrl} alt='Logo' className={logoSizeClass} />
        ) : (
          <a href={isLogin ? '/' : 'stones'}>
            <img src={logoUrl} alt='Logo' className={logoSizeClass} />
          </a>
        )}
      </div>
      <div className='md:hidden'>
        <BurgerMenu />
      </div>
    </header>
  )
}
