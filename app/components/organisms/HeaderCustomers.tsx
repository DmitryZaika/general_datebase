import {
  Link,
  type Location,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import { loginLogo } from '~/constants/logos'
import { resolveCompanyLogoHeight, resolveCompanyLogoUrl } from '~/utils/companyLogo'
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

export default function HeaderCustomers({
  hideBurgerMenu = false,
}: {
  hideBurgerMenu?: boolean
}) {
  const location = useLocation()
  const isLogin = location.pathname.includes('login')
  const isCustomersCompanies = location.pathname === '/customers/companies'
  const segments = location.pathname.split('/').filter(Boolean)
  const companyId = segments[1]
  const { companyLogoUrl, companyLogoHeight } = useLoaderData<{
    companyLogoUrl?: string | null
    companyLogoHeight?: number
  }>()
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const logoUrl = isLogin ? loginLogo : resolveCompanyLogoUrl(companyLogoUrl)
  const logoHeight = resolveCompanyLogoHeight(companyLogoHeight)
  const viewId = segments[0] === 'customer' && segments.length >= 3 ? segments[2] : ''
  const isStonesView = viewId === 'stones'
  const buttonLink = getButtonLink({ location, companyId })
  const isSurvey = location.pathname.includes('survey')
  const showStonesButton = !isLogin && !isSurvey && !isCustomersCompanies
  const logoSizeClass =
    isLogin || isCustomersCompanies
      ? 'h-36 md:h-44 object-contain'
      : 'max-w-full object-contain'
  const logoStyle = isLogin || isCustomersCompanies ? undefined : { height: logoHeight }
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
          <img src={logoUrl} alt='Logo' className={logoSizeClass} style={logoStyle} />
        ) : (
          <a href={isLogin ? '/' : 'stones'}>
            <img src={logoUrl} alt='Logo' className={logoSizeClass} style={logoStyle} />
          </a>
        )}
      </div>
      <div className='md:hidden'>{hideBurgerMenu ? null : <BurgerMenu />}</div>
    </header>
  )
}
