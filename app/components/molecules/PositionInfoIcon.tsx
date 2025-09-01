import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { getPositionById } from '~/constants/positions'

interface PositionInfoIconProps {
  positionId: number
  className?: string
}

export function PositionInfoIcon({
  positionId,
  className = 'w-4 h-4',
}: PositionInfoIconProps) {
  const position = getPositionById(positionId)

  if (!position || !position.description) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className={`${className} text-white-500 hover:text-white-700 cursor-help`}
          />
        </TooltipTrigger>
        <TooltipContent className='max-w-xs'>
          <div className='space-y-2'>
            <div className='font-semibold'>{position.displayName}</div>
            <p className='text-sm text-white-600'>{position.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
