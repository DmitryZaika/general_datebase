import { format } from 'date-fns'
import { cn } from '~/lib/utils'
import type { SmsMessage } from './types'

export interface SmsBubbleProps {
  message: SmsMessage
  onRetry?: () => void
}

export function SmsBubble({ message, onRetry }: SmsBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isPending = message.status === 'sending'
  const isFailed = message.status === 'failed'

  const bubbleColor = isOutbound
    ? isFailed
      ? 'bg-red-100 text-red-900 border border-red-300'
      : isPending
        ? 'bg-blue-300 text-white opacity-80'
        : 'bg-blue-500 text-white'
    : 'bg-slate-100 text-slate-800'

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className='max-w-[85%]'>
        <div
          className={cn(
            'rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words',
            bubbleColor,
          )}
        >
          {message.text}
        </div>
        <div
          className={cn(
            'text-[10px] mt-0.5 px-1',
            isOutbound ? 'text-right' : 'text-left',
            isFailed ? 'text-red-600' : 'text-slate-400',
          )}
        >
          {isPending && 'Sending…'}
          {isFailed && (
            <button
              type='button'
              onClick={onRetry}
              className='underline hover:text-red-800'
            >
              Failed. Retry
            </button>
          )}
          {message.status === 'sent' && (
            <>
              {!isOutbound && (
                <time dateTime={message.createdAt}>
                  {format(new Date(message.createdAt), 'h:mm a')}
                </time>
              )}
              {isOutbound && message.agent ? message.agent : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
