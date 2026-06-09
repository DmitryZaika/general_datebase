import { MessageSquare, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useRouteLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useIsMobile } from '~/hooks/use-mobile'
import { useHasCloudtalkApi } from '~/hooks/useHasCloudtalkApi'
import type { loader } from '~/root'
import type { Nullable } from '~/types/utils'
import { canonicalPhone10 } from '~/utils/phone'
import { cloudtalkBasePath } from '~/utils/urlHelpers'

interface SmsDealButtonProps {
  phone: Nullable<string>
  showCallIcon?: boolean
}

function phoneActionButtonShell({
  isMobile,
  disabled,
  ariaLabel,
  tooltip,
  children,
  onClick,
  href,
}: {
  isMobile: boolean
  disabled: boolean
  ariaLabel: string
  tooltip: string
  children: ReactNode
  onClick?: () => void
  href?: string
}) {
  const button =
    href && !disabled ? (
      <Button variant='outline' size={isMobile ? 'icon' : 'sm'} className='h-7' asChild>
        <a href={href} aria-label={ariaLabel}>
          {children}
        </a>
      </Button>
    ) : (
      <Button
        type='button'
        variant='outline'
        size={isMobile ? 'icon' : 'sm'}
        className='h-7'
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </Button>
    )

  if (!disabled) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex'>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function SmsDealButton({ phone, showCallIcon = false }: SmsDealButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const hasCloudtalkApi = useHasCloudtalkApi()
  const rootData = useRouteLoaderData<typeof loader>('root')
  const hasAgent = Boolean(rootData?.user?.cloudtalk_agent_id?.trim())
  const isEmployeeDealProject = location.pathname.includes('/employee/deals/')
  const useCallButton = isEmployeeDealProject && !hasAgent && showCallIcon

  if (isEmployeeDealProject && !hasAgent && !showCallIcon) return null

  if (!hasCloudtalkApi && !useCallButton) return null

  const digits = canonicalPhone10(String(phone ?? ''))
  const isValid = digits.length === 10
  const smsBase = cloudtalkBasePath(location.pathname)
  const telHref = isValid ? `tel:+1${digits}` : undefined

  if (useCallButton) {
    return phoneActionButtonShell({
      isMobile: true,
      disabled: !isValid,
      ariaLabel: 'Call',
      tooltip: 'No valid phone number on file',
      href: telHref,
      children: <Phone size={17} aria-hidden />,
    })
  }

  const content = (
    <>
      <MessageSquare size={17} aria-hidden />
      {!isMobile && <span className='ml-1'>CloudTalk</span>}
    </>
  )

  return phoneActionButtonShell({
    isMobile,
    disabled: !isValid,
    ariaLabel: 'Open SMS conversation',
    tooltip: 'No valid phone number on file',
    onClick: isValid ? () => navigate(`${smsBase}/thread/${digits}`) : undefined,
    children: content,
  })
}
