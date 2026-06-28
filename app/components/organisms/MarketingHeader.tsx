import { LogoutButton } from '~/components/molecules/LogoutButton'
import { resolveCompanyLogoHeight, resolveCompanyLogoUrl } from '~/utils/companyLogo'

interface MarketingHeaderProps {
  companyName?: string
  companyLogoUrl?: string | null
  companyLogoHeight?: number
}

export function MarketingHeader({
  companyName,
  companyLogoUrl,
  companyLogoHeight,
}: MarketingHeaderProps) {
  const logoUrl = resolveCompanyLogoUrl(companyLogoUrl)
  const logoHeight = resolveCompanyLogoHeight(companyLogoHeight)

  return (
    <header className='bg-white flex items-center justify-between p-3'>
      <div className='logo'>
        <a className='flex justify-center' href='/'>
          <img
            src={logoUrl}
            alt='Logo'
            className='max-w-full object-contain'
            style={{ height: logoHeight }}
          />
        </a>
      </div>
      {companyName && (
        <div className='text-center flex-1'>
          <span className='text-sm md:text-base font-medium'>{companyName}</span>
        </div>
      )}
      <div className='flex items-center gap-2'>
        <LogoutButton />
      </div>
    </header>
  )
}
