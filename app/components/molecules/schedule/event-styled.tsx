import { ClockIcon, TrashIcon } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useScheduler } from '~/providers/scheduler-provider'

// Function to format date
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

// Variant colors mapping
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

// Define the proper Event interface
interface Event {
  id: number
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: string
  notes?: string
}

interface EventStyledProps extends Event {
  minmized?: boolean
  CustomEventComponent?: React.FC<Event>
}

export default function EventStyled({
  event,
  onDelete,
}: {
  event: EventStyledProps
  onDelete?: (id: string) => void
}) {
  const { handlers } = useScheduler()
  const [showEditModal, setShowEditModal] = useState(false)

  // Determine if delete button should be shown
  // Hide it for minimized events to save space, show on hover instead
  const shouldShowDeleteButton = !event?.minmized

  // Handler function to open edit modal
  function handleEditEvent(e?: React.MouseEvent) {
    e?.stopPropagation() // Prevent event bubbling to parent
    e?.preventDefault() // Also prevent default behavior
    setShowEditModal(true)
  }

  // Get background color class based on variant
  const getBackgroundColor = (variant: string | undefined) => {
    const variantKey = (variant as keyof typeof variantColors) || 'primary'
    const colors = variantColors[variantKey] || variantColors.primary
    return `${colors.bg} ${colors.text} ${colors.border}`
  }
  return (
    <>
      <div
        key={event?.id}
        data-event-element
        className={cn(
          'w-full z-50 relative cursor-pointer border group rounded-lg flex flex-col flex-grow shadow-sm hover:shadow-md transition-shadow duration-200',
          event?.minmized ? 'border-transparent' : 'border-default-400/60',
        )}
      >
        {/* Delete button - shown by default for non-minimized, or on hover for minimized */}
        <Button
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation()
            handlers.handleDeleteEvent(event?.id.toString())
            onDelete?.(event?.id.toString())
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

        {event.CustomEventComponent ? (
          <div onClick={handleEditEvent}>
            <event.CustomEventComponent {...event} />
          </div>
        ) : (
          <div
            onClick={handleEditEvent}
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
                    <p className='text-xs opacity-75 line-clamp-2'>
                      {event.description}
                    </p>
                  )}

                  {/* Badge for variant */}
                  <div className='flex items-center justify-between mt-2'>
                    <Badge
                      variant={
                        event?.variant === 'danger' ? 'destructive' : 'secondary'
                      }
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

      {/* Edit Event Modal */}
      {showEditModal && (
        <AddEventModal
          open={true}
          onOpenChange={setShowEditModal}
          defaultValues={{
            id: event.id,
            title: event.title,
            description: event.description,
            startDate: event.startDate,
            endDate: event.endDate,
            variant: event.variant,
            notes: event.notes,
          }}
        />
      )}
    </>
  )
}
