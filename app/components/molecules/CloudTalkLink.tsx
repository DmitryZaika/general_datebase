import { type ReactNode, useMemo } from 'react'
import { buildCloudTalkCallHref, phoneDigits } from '~/utils/cloudtalkPhone'

interface CloudTalkLinkProps {
  phone: string
  className?: string
  children?: ReactNode
}

export function CloudTalkLink({ phone, className, children }: CloudTalkLinkProps) {
  const href = useMemo(() => {
    if (typeof window === 'undefined') {
      return `tel:${phoneDigits(phone)}`
    }
    return buildCloudTalkCallHref(phone)
  }, [phone])

  const cleanPhone = phoneDigits(phone)
  if (!cleanPhone || !href) return null

  return (
    <a href={href} className={className}>
      {children ?? phone}
    </a>
  )
}
