import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '~/lib/utils'
import { formatPhoneForDisplay } from '~/utils/phone'
import type { SmsEntry, SmsThread } from '~/utils/smsDisplayHelpers'

interface SmsThreadCardProps {
  thread: SmsThread
  compact?: boolean
  defaultExpanded?: boolean
}

const EXPAND_VARIANTS = {
  collapsed: { opacity: 0, height: 0 },
  expanded: { opacity: 1, height: 'auto' },
}

const EXPAND_TRANSITION = { duration: 0.2, ease: 'easeInOut' as const }

interface DayGroup {
  dayKey: string
  dayLabel: string
  messages: SmsEntry[]
}

function groupMessagesByDay(messages: SmsEntry[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const msg of messages) {
    const date = new Date(msg.createdDate)
    const dayKey = format(date, 'yyyy-MM-dd')
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) {
      last.messages.push(msg)
    } else {
      groups.push({
        dayKey,
        dayLabel: format(date, 'MMM d, yyyy'),
        messages: [msg],
      })
    }
  }
  return groups
}

export function SmsThreadCard({
  thread,
  compact = false,
  defaultExpanded = false,
}: SmsThreadCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const bodyId = `sms-thread-body-${thread.customerPhone}`
  const latestMessage = thread.messages[thread.messages.length - 1]

  const dayGroups = useMemo(
    () => (isExpanded ? groupMessagesByDay(thread.messages) : []),
    [isExpanded, thread.messages],
  )

  return (
    <div className={cn('flex items-start text-sm', compact ? 'gap-2' : 'gap-3')}>
      <span className='mt-0.5 shrink-0 text-indigo-500'>
        <MessageSquare size={compact ? 14 : 16} />
      </span>

      <div className='flex-1 min-w-0'>
        <button
          type='button'
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={bodyId}
          className='w-full text-left'
        >
          <div className='flex items-baseline justify-between gap-2'>
            <span
              className={cn(
                'font-medium truncate',
                compact ? 'text-xs text-gray-800' : 'text-sm text-slate-800',
              )}
            >
              {formatPhoneForDisplay(thread.customerPhone)}
              <span
                className={cn(
                  'font-normal ml-1',
                  compact ? 'text-[10px] text-gray-500' : 'text-xs text-slate-500',
                )}
              >
                · {thread.count} {thread.count === 1 ? 'message' : 'messages'}
              </span>
            </span>
            <span
              className={cn(
                'flex items-center gap-1 shrink-0',
                compact ? 'text-[10px] text-gray-500' : 'text-xs text-slate-500',
              )}
            >
              <time dateTime={thread.lastMessageAt}>
                {format(new Date(thread.lastMessageAt), 'M/d h:mm a')}
              </time>
              <ChevronDown
                size={compact ? 12 : 14}
                className={cn(
                  'transition-transform duration-200',
                  isExpanded && 'rotate-180',
                )}
              />
            </span>
          </div>

          {!isExpanded && (
            <div
              className={cn(
                'truncate mt-0.5',
                compact ? 'text-[11px] text-gray-500' : 'text-xs text-slate-500',
              )}
            >
              <span className='text-slate-400 mr-1'>
                {latestMessage.direction === 'outbound' ? '→' : '←'}
              </span>
              <span className='italic'>{latestMessage.text}</span>
              {latestMessage.direction === 'outbound' && latestMessage.agent && (
                <span className='text-slate-400'> · {latestMessage.agent}</span>
              )}
            </div>
          )}
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id={bodyId}
              role='region'
              variants={EXPAND_VARIANTS}
              initial='collapsed'
              animate='expanded'
              exit='collapsed'
              transition={EXPAND_TRANSITION}
              className='overflow-hidden'
            >
              <div
                className={cn(
                  'overflow-y-auto space-y-3 mt-2 pr-1',
                  compact ? 'max-h-48' : 'max-h-80',
                )}
              >
                {dayGroups.map(group => (
                  <div key={group.dayKey} className='space-y-1.5'>
                    <div className='text-[11px] text-slate-400 text-center py-1'>
                      — {group.dayLabel} —
                    </div>
                    {group.messages.map(msg => {
                      const isOutbound = msg.direction === 'outbound'
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            isOutbound ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <div className='max-w-[85%]'>
                            <div
                              className={cn(
                                'rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words',
                                isOutbound
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-slate-100 text-slate-800',
                              )}
                            >
                              {msg.text}
                            </div>
                            <div
                              className={cn(
                                'text-[10px] text-slate-400 mt-0.5 px-1',
                                isOutbound ? 'text-right' : 'text-left',
                              )}
                            >
                              <time dateTime={msg.createdDate}>
                                {format(new Date(msg.createdDate), 'h:mm a')}
                              </time>
                              {isOutbound && msg.agent ? ` · ${msg.agent}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
