import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bell } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { queryClient } from '~/utils/api'

interface NotificationItem {
  id: string | number
  title?: string
  message: string
}

interface NotificationProps {
  className?: string
}
async function getNotifications(): Promise<NotificationItem[]> {
  const response = await fetch('/api/notifications')
  if (!response.ok) {
    throw Error('Bad Request')
  }

  const data: { notifications: NotificationItem[] } = await response.json()
  return data.notifications
}

export function Notification({ className }: NotificationProps) {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  })

  const mutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch('/api/notifications/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label='Notifications'
          className={clsx(
            'relative inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 focus:outline-none',
            className,
          )}
        >
          <Bell className='h-6 w-6 text-black' />
          {notifications.length > 0 && (
            <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white'>
              !
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-80 p-0'>
        <div className='max-h-60 overflow-auto py-2'>
          {isLoading ? (
            <p className='py-4 text-center text-sm text-gray-500'>Loading...</p>
          ) : notifications.length === 0 ? (
            <p className='py-4 text-center text-sm text-gray-500'>
              You have no notifications.
            </p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className='flex items-start justify-between gap-2 mb-1 border-b px-4 py-2 last:border-0 hover:bg-gray-50'
              >
                <div>
                  {n.title && (
                    <p className='text-sm font-medium text-gray-800'>{n.title}</p>
                  )}
                  <p className='text-sm text-gray-600'>{n.message}</p>
                </div>
                <Button size='sm' onClick={() => mutation.mutate(Number(n.id))}>
                  Done
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
