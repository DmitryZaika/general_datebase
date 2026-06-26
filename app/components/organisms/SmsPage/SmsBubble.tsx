import { format } from 'date-fns'
import { cn } from '~/lib/utils'
import { SmsMessageReactions } from './SmsMessageReactions'
import type { SmsMessage } from './types'

export interface SmsBubbleProps {
  message: SmsMessage
  reactions?: string[]
  onRetry?: () => void
  onReact?: (emoji: string, reactedToText: string) => void
  canReact?: boolean
  isReacting?: boolean
}

export function SmsBubble({
  message,
  reactions = [],
  onRetry,
  onReact,
  canReact = false,
  isReacting = false,
}: SmsBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isPending = message.status === 'sending'
  const isFailed = message.status === 'failed'
  const hasReactions = reactions.length > 0

  const bubbleColor = isOutbound
    ? isFailed
      ? 'bg-red-100 text-red-900 border border-red-300'
      : isPending
        ? 'bg-blue-300 text-white opacity-80'
        : 'bg-blue-500 text-white'
    : 'bg-slate-100 text-slate-800'

  const showReactionPicker = canReact && onReact && message.status === 'sent'

  return (
    <div
      className={cn(
        'group flex items-end gap-1',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%]',
          isOutbound ? 'flex flex-col items-end' : 'flex flex-col items-start',
        )}
      >
        <div className='w-fit max-w-full'>
          <div
            className={cn(
              'rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words',
              bubbleColor,
            )}
          >
            {message.text}
          </div>
          {hasReactions ? (
            <div
              className={cn(
                'flex items-center gap-0.5 -mt-2',
                isOutbound ? 'justify-start pl-0.5' : 'justify-end pr-0',
              )}
            >
              {reactions.map(emoji => (
                <button
                  key={emoji}
                  type='button'
                  disabled={!onReact || isReacting}
                  onClick={() => onReact?.(emoji, message.text)}
                  className='inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-slate-200 bg-white px-[3px] text-[11px] leading-none shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-white'
                  aria-label={`Remove ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            'text-[10px] px-1',
            hasReactions && 'mt-0.5',
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
            <time dateTime={message.createdAt}>
              {format(new Date(message.createdAt), 'h:mm a')}
            </time>
          )}
        </div>
      </div>
      {showReactionPicker ? (
        <SmsMessageReactions
          onPick={emoji => onReact(emoji, message.text)}
          disabled={isReacting}
        />
      ) : null}
    </div>
  )
}
