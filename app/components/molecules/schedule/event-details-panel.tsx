import {
  ChevronRight,
  MapPin,
  MoreVertical,
  Palette,
  Pencil,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
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
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Event } from '@/types'
import { useScheduler } from '~/providers/scheduler-provider'

function formatEventDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatEventTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getColorLabel(color?: string) {
  if (color === 'red') return 'Red'
  if (color === 'green') return 'Green'
  if (color === 'yellow') return 'Yellow'
  return 'Blue'
}

function getTitleColorClass(variant?: string) {
  if (variant === 'success') return 'text-green-600 dark:text-green-400'
  if (variant === 'danger') return 'text-red-600 dark:text-red-400'
  if (variant === 'warning') return 'text-yellow-600 dark:text-yellow-400'
  if (variant === 'default') return 'text-foreground'
  return 'text-blue-600 dark:text-blue-400'
}

function getDotColorClass(color?: string) {
  if (color === 'red') return 'bg-red-500'
  if (color === 'green') return 'bg-green-500'
  if (color === 'yellow') return 'bg-yellow-500'
  return 'bg-blue-500'
}

export default function EventDetailsPanel({
  event,
  onClose,
}: {
  event: Event
  onClose: () => void
}) {
  const { handlers } = useScheduler()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function confirmDelete() {
    setIsDeleting(true)
    try {
      await handlers.handleDeleteEvent(event.id)
      setShowDeleteConfirm(false)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className='flex h-full w-full flex-col'>
        <div className='flex items-center justify-between border-b px-4 py-3'>
          <h2 className='text-sm font-medium text-muted-foreground'>Event details</h2>
          <div className='flex items-center gap-1'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={onClose}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-4 py-6'>
          <div className='mx-auto flex max-w-sm flex-col items-center text-center'>
            <div
              className={cn(
                'mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white',
                getDotColorClass(event.color),
              )}
            >
              {event.title.charAt(0).toUpperCase()}
            </div>

            <h3
              className={cn(
                'mb-2 text-xl font-semibold leading-tight',
                getTitleColorClass(event.variant),
              )}
            >
              {event.title}
            </h3>

            <p className='mb-4 text-sm text-muted-foreground'>
              {formatEventDate(event.startDate)}
            </p>

            {event.allDay ? (
              <p className='text-2xl font-light text-foreground'>All day</p>
            ) : (
              <div className='flex items-center gap-3'>
                <span className='text-2xl font-light text-foreground'>
                  {formatEventTime(event.startDate)}
                </span>
                <ChevronRight className='h-5 w-5 text-green-600' />
                <span className='text-2xl font-light text-foreground'>
                  {formatEventTime(event.endDate)}
                </span>
              </div>
            )}
          </div>

          <div className='mt-8 space-y-4 border-t pt-6'>
            {event.status && (
              <div className='flex items-start gap-3 text-sm'>
                <Tag className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                <div>
                  <p className='text-muted-foreground'>Status</p>
                  <p className='capitalize'>{event.status}</p>
                </div>
              </div>
            )}

            <div className='flex items-start gap-3 text-sm'>
              <Palette className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
              <div>
                <p className='text-muted-foreground'>Color</p>
                <div className='flex items-center gap-2'>
                  <span
                    className={cn('size-3 rounded-full', getDotColorClass(event.color))}
                  />
                  <p>{getColorLabel(event.color)}</p>
                </div>
              </div>
            </div>

            {event.saleId && (
              <div className='flex items-start gap-3 text-sm'>
                <MapPin className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                <div>
                  <p className='text-muted-foreground'>Deal</p>
                  <Link
                    to={`/employee/deals/edit/${event.saleId}/project`}
                    className='text-primary hover:underline'
                  >
                    View deal #{event.saleId}
                  </Link>
                </div>
              </div>
            )}

            {event.description && (
              <div className='text-sm'>
                <p className='mb-1 text-muted-foreground'>Description</p>
                <p className='whitespace-pre-wrap'>{event.description}</p>
              </div>
            )}

            {event.notes && (
              <div className='text-sm'>
                <p className='mb-1 text-muted-foreground'>Notes</p>
                <p className='whitespace-pre-wrap'>{event.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className='border-t p-4'>
          <Button
            className='w-full'
            variant='outline'
            onClick={() => setShowEditModal(true)}
          >
            <Pencil className='mr-2 h-4 w-4' />
            Edit event
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{event.title}&quot;?
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
            allDay: event.allDay,
          }}
        />
      )}
    </>
  )
}
