import { PhoneIcon } from 'lucide-react'
import { CloudTalkLink } from '~/components/molecules/CloudTalkLink'
import { useIsMobile } from '~/hooks/use-mobile'
import { hasCloudTalkAgentId, phoneDigits } from '~/utils/cloudtalkPhone'

interface DealPhoneCallLinkProps {
  phone: string
  cloudtalkAgentId: string | null
}

export function DealPhoneCallLink({ phone, cloudtalkAgentId }: DealPhoneCallLinkProps) {
  const isMobile = useIsMobile()
  const digits = phoneDigits(phone)
  const linkClassName =
    'inline-flex h-7 items-center justify-center rounded-md border-2 border-gray-300 px-2'

  if (!digits) return null

  if (hasCloudTalkAgentId(cloudtalkAgentId)) {
    return (
      <CloudTalkLink phone={phone} className={linkClassName}>
        <PhoneIcon size={17} />
      </CloudTalkLink>
    )
  }

  if (!isMobile) {
    return null
  }

  return (
    <a href={`tel:${digits}`} className={linkClassName}>
      <PhoneIcon size={17} />
    </a>
  )
}
