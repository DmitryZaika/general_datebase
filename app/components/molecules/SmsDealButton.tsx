import { MessageSquare } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useIsMobile } from '~/hooks/use-mobile'
import type { Nullable } from '~/types/utils'
import { canonicalPhone10 } from '~/utils/phone'
import { cloudtalkBasePath } from '~/utils/urlHelpers'

interface SmsDealButtonProps {
  phone: Nullable<string>
}

export function SmsDealButton({ phone }: SmsDealButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  const digits = canonicalPhone10(String(phone ?? ''))
  const isValid = digits.length === 10
  const smsBase = cloudtalkBasePath(location.pathname)

  const content = (
    <>
      <MessageSquare size={17} aria-hidden />
      {!isMobile && <span className='ml-1'>CloudTalk</span>}
    </>
  )

  if (!isValid) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex'>
            <Button
              type='button'
              variant='outline'
              size={isMobile ? 'icon' : 'sm'}
              className='h-7'
              disabled
              aria-label='SMS unavailable — no valid phone number'
            >
              {content}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>No valid phone number on file</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      type='button'
      variant='outline'
      size={isMobile ? 'icon' : 'sm'}
      className='h-7'
      onClick={() => navigate(`${smsBase}/thread/${digits}`)}
      aria-label='Open SMS conversation'
    >
      {content}
    </Button>
  )
}
