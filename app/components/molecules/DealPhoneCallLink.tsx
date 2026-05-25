import { PhoneIcon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { CopyText } from '~/components/atoms/CopyText'
import { useIsMobile } from '~/hooks/use-mobile'
import {
  buildTelHref,
  phoneDigits,
  shouldShowPhoneCallLink,
} from '~/utils/cloudtalkPhone'

interface DealPhoneCallLinkProps {
  phone: string
  cloudtalkAgentId: string | null
}

export function DealPhoneCallLink({ phone, cloudtalkAgentId }: DealPhoneCallLinkProps) {
  const isMobileLayout = useIsMobile()
  const telHref = buildTelHref(phone)
  const linkClassName =
    'inline-flex h-7 items-center justify-center rounded-md border-2 border-gray-300 px-2'

  if (!phoneDigits(phone) || !telHref) return null

  if (
    !shouldShowPhoneCallLink({
      isMobileLayout,
      cloudtalkAgentId,
    })
  ) {
    return null
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation()
    window.location.href = telHref
  }

  return (
    <a href={telHref} className={linkClassName} onClick={handleClick}>
      <PhoneIcon size={17} />
    </a>
  )
}

export function DealPhoneNumberLink({
  phone,
  cloudtalkAgentId,
  className,
}: {
  phone: string
  cloudtalkAgentId: string | null
  className?: string
}) {
  const isMobileLayout = useIsMobile()
  const telHref = buildTelHref(phone)

  if (!phoneDigits(phone) || !telHref) return null

  if (
    !shouldShowPhoneCallLink({
      isMobileLayout,
      cloudtalkAgentId,
    })
  ) {
    return null
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation()
    window.location.href = telHref
  }

  return (
    <a href={telHref} className={className} onClick={handleClick}>
      {phone}
    </a>
  )
}

export function DealPhoneField({
  phone,
  cloudtalkAgentId,
}: {
  phone: string
  cloudtalkAgentId: string | null
}) {
  const isMobileLayout = useIsMobile()
  const showCall = shouldShowPhoneCallLink({
    isMobileLayout,
    cloudtalkAgentId,
  })

  return (
    <div className='flex gap-2'>
      {showCall ? (
        <DealPhoneNumberLink
          phone={phone}
          cloudtalkAgentId={cloudtalkAgentId}
          className='font-bold'
        />
      ) : (
        <CopyText value={phone} className='font-bold' />
      )}
      <DealPhoneCallLink phone={phone} cloudtalkAgentId={cloudtalkAgentId} />
    </div>
  )
}
