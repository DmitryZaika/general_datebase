import { Calendar, Clock, Edit, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useScheduler } from '~/providers/scheduler-provider'

interface Event {
  id: number
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: string
  notes?: string
}

interface DayEventsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date
  events: Event[]
  onEditEvent: (event: Event) => void
  onAddEvent: (date: Date) => void
}

// Function to format time
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Function to format date
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Get variant color classes
const getVariantColors = (variant?: string) => {
  switch (variant) {
    case 'primary':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800'
    case 'danger':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800'
    case 'success':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800'
    case 'warning':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800'
  }
}

export default function DayEventsModal({
  open,
  onOpenChange,
  date,
  events,
  onEditEvent,
  onAddEvent,
}: DayEventsModalProps) {
  const { handlers } = useScheduler()

  const handleDeleteEvent = async (eventId: number) => {
    if (confirm('Are you sure you want to delete this event?')) {
      handlers.handleDeleteEvent(eventId.toString())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px] max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-lg'>
            <Calendar className='w-5 h-5' />
            Events for {formatDate(date)}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Add Event Button */}
          <Button onClick={() => onAddEvent(date)} className='w-full' variant='outline'>
            <Plus className='w-4 h-4 mr-2' />
            Add New Event
          </Button>

          {/* Events List */}
          {events.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Calendar className='w-12 h-12 mx-auto mb-3 opacity-50' />
              <p>No events scheduled for this day</p>
            </div>
          ) : (
            <div className='max-h-[400px] overflow-y-auto'>
              <div className='space-y-3'>
                {events.map(event => (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border ${getVariantColors(event.variant)} hover:shadow-md transition-shadow`}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1 min-w-0'>
                        <h3 className='font-semibold text-sm mb-1 truncate'>
                          {event.title}
                        </h3>

                        <div className='flex items-center gap-1 text-xs opacity-75 mb-2'>
                          <Clock className='w-3 h-3' />
                          <span>
                            {formatTime(event.startDate)} - {formatTime(event.endDate)}
                          </span>
                        </div>

                        {event.description && (
                          <p className='text-xs opacity-75 line-clamp-2 mb-2'>
                            {event.description}
                          </p>
                        )}

                        {event.variant && (
                          <Badge
                            variant={
                              event.variant === 'danger' ? 'destructive' : 'secondary'
                            }
                            className='text-xs px-2 py-0'
                          >
                            {event.variant}
                          </Badge>
                        )}
                      </div>

                      <div className='flex gap-1 ml-2'>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => onEditEvent(event)}
                          className='h-8 w-8 p-0'
                        >
                          <Edit className='w-3 h-3' />
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleDeleteEvent(event.id)}
                          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                        >
                          <Trash2 className='w-3 h-3' />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
