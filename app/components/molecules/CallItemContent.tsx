import { format } from 'date-fns'
import { Star } from 'lucide-react'
import { AudioWaveformPlayer } from '~/components/molecules/AudioWaveformPlayer'
import type { CallEntry } from '~/components/molecules/CallHistory'
import { cn } from '~/lib/utils'
import {
  formatDuration,
  getCallIcon,
  getCallStatus,
  getStatusColor,
} from '~/utils/callDisplayHelpers'

interface CallItemContentProps {
  call: CallEntry
  audioSrc: string
  compact?: boolean
}

export function CallItemContent({
  call,
  audioSrc,
  compact = false,
}: CallItemContentProps) {
  const { Icon, color } = getCallIcon(call)
  const status = getCallStatus(call)

  return (
    <div className={cn('flex items-start text-sm', compact ? 'gap-2' : 'gap-3')}>
      <span className={cn('mt-0.5 shrink-0', color)}>
        <Icon size={compact ? 14 : 16} />
      </span>

      <div className='flex-1 min-w-0'>
        <div className='flex items-baseline justify-between gap-2'>
          <span
            className={cn(compact ? 'text-xs text-gray-800' : 'text-sm text-slate-800')}
          >
            {format(new Date(call.startedAt), 'M/d/yyyy h:mm a')}
          </span>
          {status ? (
            <span
              className={cn(
                'font-semibold',
                compact ? 'text-[10px]' : 'text-xs',
                getStatusColor(status),
              )}
            >
              {status}
            </span>
          ) : (
            <span className={cn('text-slate-500', compact ? 'text-[10px]' : 'text-xs')}>
              {formatDuration(call.talkingTime)}
            </span>
          )}
        </div>

        <div
          className={cn(
            compact ? 'text-[11px] text-gray-500' : 'text-xs text-slate-500',
          )}
        >
          Agent: {call.agentName}
        </div>

        {call.notes.length > 0 && (
          <div
            className={cn(
              'mt-1',
              compact ? 'text-[11px] text-gray-500' : 'text-xs text-slate-600',
            )}
          >
            {call.notes.map(n => (
              <div key={n.id} className='italic'>
                {n.name}
              </div>
            ))}
          </div>
        )}

        {call.tags.length > 0 && (
          <div className='mt-1 flex gap-1 flex-wrap'>
            {call.tags.map(t => (
              <span
                key={t.id}
                className='text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full'
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {call.ratings.length > 0 && (
          <div className='mt-1 flex items-center gap-1'>
            {call.ratings.map(r => (
              <span
                key={r.id}
                className='flex items-center gap-0.5 text-[10px] text-amber-500'
              >
                <Star size={10} fill='currentColor' />
                {r.rating}
              </span>
            ))}
          </div>
        )}

        {call.recorded && (
          <div className={cn(compact ? 'mt-1.5' : 'mt-1')}>
            <AudioWaveformPlayer audioSrc={audioSrc} compact />
          </div>
        )}
      </div>
    </div>
  )
}
