import { format } from 'date-fns'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { AudioWaveformPlayer } from '~/components/molecules/AudioWaveformPlayer'
import { cn } from '~/lib/utils'
import {
  type CallEntry,
  formatDuration,
  getCallIcon,
  getCallStatus,
  getStatusColor,
} from '~/utils/callDisplayHelpers'

interface CallItemContentProps {
  call: CallEntry
  audioSrc: string
  compact?: boolean
  historyCompact?: boolean
}

export function CallItemContent({
  call,
  audioSrc,
  compact = false,
  historyCompact = false,
}: CallItemContentProps) {
  const [showRecording, setShowRecording] = useState(false)
  const { Icon, color } = getCallIcon(call)
  const status = getCallStatus(call)

  if (historyCompact) {
    const startedAt = new Date(call.startedAt)
    const startedLabel = Number.isNaN(startedAt.getTime())
      ? ''
      : format(startedAt, 'MMM d, h:mm a')
    const label =
      call.type === 'outgoing'
        ? 'Outgoing'
        : call.type === 'incoming'
          ? 'Incoming'
          : 'Call'
    const detail = status ?? formatDuration(call.talkingTime)

    return (
      <div className='flex flex-col gap-0.5 rounded-md px-2 py-1.5'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className={cn('shrink-0', color)}>
              <Icon size={14} />
            </span>
            <span className='text-sm font-medium truncate'>{label}</span>
            <span
              className={cn(
                'text-[10px] shrink-0',
                status ? getStatusColor(status) : 'text-gray-500',
              )}
            >
              {detail}
            </span>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            {call.recorded ? (
              <button
                type='button'
                className='rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50'
                onClick={() => setShowRecording(value => !value)}
              >
                {showRecording ? 'Hide voice call' : 'Voice call'}
              </button>
            ) : null}
            <span className='text-[10px] text-gray-500 w-22 text-right tabular-nums'>
              {startedLabel}
            </span>
          </div>
        </div>
        {showRecording ? (
          <div className='mt-1'>
            <AudioWaveformPlayer audioSrc={audioSrc} compact />
          </div>
        ) : null}
      </div>
    )
  }

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
            <AudioWaveformPlayer audioSrc={audioSrc} compact={compact} />
          </div>
        )}
      </div>
    </div>
  )
}
