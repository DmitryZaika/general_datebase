import { ClockIcon, TrashIcon } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useScheduler } from '~/providers/scheduler-provider'

const formatDate = (date: Date) => {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  })
}

const getMonthPillColor = (variant?: string, color?: string) => {
  const key = color ?? variant
  if (key === 'red' || key === 'danger') return 'bg-red-500 text-white'
  if (key === 'green' || key === 'success') return 'bg-green-600 text-white'
  if (key === 'yellow' || key === 'warning') return 'bg-amber-500 text-white'
  if (key === 'default') return 'bg-gray-500 text-white'
  return 'bg-blue-500 text-white'
}

const variantColors = {
  primary: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-900 dark:text-blue-100',
    border: 'border-blue-200 dark:border-blue-800',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-900 dark:text-red-100',
    border: 'border-red-200 dark:border-red-800',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-950',
    text: 'text-green-900 dark:text-green-100',
    border: 'border-green-200 dark:border-green-800',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    text: 'text-yellow-900 dark:text-yellow-100',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  default: {
    bg: 'bg-gray-50 dark:bg-gray-950',
    text: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-800',
  },
}

const getBackgroundColor = (variant?: string) => {
  if (variant === 'danger') {
    return `${variantColors.danger.bg} ${variantColors.danger.text} ${variantColors.danger.border}`
  }
  if (variant === 'success') {
    return `${variantColors.success.bg} ${variantColors.success.text} ${variantColors.success.border}`
  }
  if (variant === 'warning') {
    return `${variantColors.warning.bg} ${variantColors.warning.text} ${variantColors.warning.border}`
  }
  if (variant === 'default') {
    return `${variantColors.default.bg} ${variantColors.default.text} ${variantColors.default.border}`
  }
  return `${variantColors.primary.bg} ${variantColors.primary.text} ${variantColors.primary.border}`
}

// Define the proper Event interface
interface Event {
  id: number
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: 'primary' | 'danger' | 'success' | 'warning' | 'default'
  color?: string
  notes?: string
  allDay?: boolean
}

interface EventStyledProps extends Event {
  minmized?: boolean
  monthView?: boolean
  CustomEventComponent?: React.FC<Event>
}

export default function EventStyled({
  event,
  onDelete,
}: {
  event: EventStyledProps
  onDelete?: (id: number) => void
}) {
  const { handlers, setSelectedEventId, selectedEventId } = useScheduler()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleSelectEvent(e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    setSelectedEventId(event?.id)
  }

  async function confirmDelete() {
    setIsDeleting(true)
    try {
      await handlers.handleDeleteEvent(event?.id)
      onDelete?.(event?.id)
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  if (event?.monthView) {
    return (
      <div
        key={event?.id}
        data-event-element
        onClick={handleSelectEvent}
        title={event.title}
        className={cn(
          'w-full min-w-0 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 truncate cursor-pointer',
          getMonthPillColor(event?.variant, event?.color),
          selectedEventId === event.id && 'ring-2 ring-foreground/20',
        )}
      >
        {event.title}
      </div>
    )
  }

  return (
    <div
      key={event?.id}
      data-event-element
      className={cn(
        'w-full z-50 relative cursor-pointer border group rounded-lg flex flex-col flex-grow shadow-sm hover:shadow-md transition-shadow duration-200',
        event?.minmized ? 'border-transparent' : 'border-default-400/60',
      )}
    >
      {/* Delete button - shown by default for non-minimized, or on hover for minimized */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Button
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation()
            setShowDeleteConfirm(true)
          }}
          variant='destructive'
          size='icon'
          className={cn(
            'absolute z-[100] right-1 top-[-8px] h-6 w-6 p-0 shadow-md hover:bg-destructive/90 transition-all duration-200',
            event?.minmized ? 'opacity-0 group-hover:opacity-100' : 'opacity-100',
          )}
        >
          <TrashIcon size={14} className='text-destructive-foreground' />
        </Button>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{event?.title}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {event.CustomEventComponent ? (
        <div onClick={handleSelectEvent}>
          <event.CustomEventComponent {...event} />
        </div>
      ) : (
        <div
          onClick={handleSelectEvent}
          className={cn(
            'w-full p-2 rounded',
            getBackgroundColor(event?.variant),
            event?.minmized ? 'flex-grow overflow-hidden' : 'min-h-fit',
          )}
        >
          {/* Event content */}
          <div className='flex flex-col h-full'>
            {/* Title section */}
            <div className='flex items-start justify-between mb-1'>
              <h3
                className={cn(
                  'font-medium text-sm leading-tight',
                  event?.minmized ? 'line-clamp-1' : 'line-clamp-2',
                )}
              >
                {event?.title}
              </h3>
            </div>

            {/* Time and description section */}
            {!event?.minmized && (
              <div className='flex-grow space-y-1'>
                {/* Time display */}
                <div className='flex items-center text-xs opacity-75'>
                  <ClockIcon size={10} className='mr-1' />
                  <span>
                    {formatDate(event?.startDate)} - {formatDate(event?.endDate)}
                  </span>
                </div>

                {/* Description */}
                {event?.description && (
                  <p className='text-xs opacity-75 line-clamp-2'>{event.description}</p>
                )}

                {/* Badge for variant */}
                <div className='flex items-center justify-between mt-2'>
                  <Badge
                    variant={event?.variant === 'danger' ? 'destructive' : 'secondary'}
                    className='text-xs px-1 py-0'
                  >
                    {event?.variant || 'default'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Minimized view - show only essential info */}
            {event?.minmized && (
              <div className='text-xs opacity-75 truncate'>
                <span>{formatDate(event?.startDate)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
