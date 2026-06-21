import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { getPositionById } from '~/constants/positions'

interface PositionInfoIconProps {
  positionId: number
  className?: string
}

export function PositionInfoIcon({
  positionId,
  className = 'h-3 w-3',
}: PositionInfoIconProps) {
  const position = getPositionById(positionId)
  if (!position) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={`About ${position.displayName}`}
          className='inline-flex shrink-0 text-gray-400 hover:text-gray-600 cursor-help'
          onClick={e => e.preventDefault()}
        >
          <Info className={className} />
        </button>
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={6} className='max-w-sm'>
        <div className='space-y-1'>
          <div className='font-semibold'>{position.displayName}</div>
          {position.description ? (
            <p className='text-sm leading-snug'>{position.description}</p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function AdminInfoIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label='About Administrator'
          className='inline-flex shrink-0 text-gray-400 hover:text-gray-600 cursor-help'
          onClick={e => e.preventDefault()}
        >
          <Info className={className} />
        </button>
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={6} className='max-w-sm'>
        <div className='space-y-1'>
          <div className='font-semibold'>Administrator</div>
          <p className='text-sm leading-snug'>
            Full admin access to this company: users, customers, deals, settings, and
            all company data in the admin portal.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
