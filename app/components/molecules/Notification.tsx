import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bell, X } from 'lucide-react'
import { useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

interface NotificationItem {
  id: string | number
  title?: string
  message: string
  href?: string
  type_title?: string
  actor_name?: string
  customer_name?: string
}

interface NotificationProps {
  className?: string
}
async function getNotifications(): Promise<NotificationItem[]> {
  const response = await fetch('/api/notifications', {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw Error('Bad Request')
  }

  const data: { notifications: NotificationItem[] } = await response.json()
  return data.notifications
}

export function Notification({ className }: NotificationProps) {
  const queryClient = useQueryClient()
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  })

  const handleDismiss = useCallback(
    async (id: string | number) => {
      const numericId = Number(String(id).replace('notif-', ''))
      queryClient.setQueryData<NotificationItem[]>(['notifications'], old =>
        (old ?? []).filter(n => n.id !== id),
      )
      await fetch('/api/notifications/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: numericId }),
      })
      queryClient.invalidateQueries({
        queryKey: ['notifications'],
      })
    },
    [queryClient],
  )

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
            <span className='absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white'>
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
            notifications.map(n => {
              const isDismissible = String(n.id).startsWith('notif-')
              const hasRichLayout = n.type_title

              return (
                <div
                  key={n.id}
                  className='flex items-start justify-between gap-2 border-b px-4 py-2 last:border-0 hover:bg-gray-50'
                >
                  {hasRichLayout ? (
                    <div className='flex min-w-0 flex-1 flex-col gap-1'>
                      <h4 className='text-base font-semibold text-gray-900'>
                        {n.type_title}
                      </h4>
                      <div className='flex flex-col gap-0.5'>
                        {n.message && (
                          <p className='truncate text-sm text-gray-600'>{n.message}</p>
                        )}
                        {n.href ? (
                          <a
                            className='text-sm text-gray-500 underline hover:text-gray-700'
                            href={n.href}
                            onClick={
                              isDismissible ? () => handleDismiss(n.id) : undefined
                            }
                          >
                            for {n.customer_name || n.title}
                            &apos;s deal
                          </a>
                        ) : (
                          <p className='text-sm text-gray-500'>
                            {n.customer_name || n.title}
                          </p>
                        )}
                      </div>
                      {n.actor_name && (
                        <span className='text-xs text-gray-400'>
                          created by {n.actor_name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className='min-w-0 flex-1'>
                      {n.title && (
                        <p className='text-sm font-medium text-gray-800'>{n.title}</p>
                      )}
                      {n.href ? (
                        <a
                          className='text-sm text-gray-600 underline'
                          href={n.href}
                          onClick={
                            isDismissible ? () => handleDismiss(n.id) : undefined
                          }
                        >
                          {n.message}
                        </a>
                      ) : (
                        <p className='text-sm text-gray-600'>{n.message}</p>
                      )}
                    </div>
                  )}
                  {isDismissible && (
                    <button
                      type='button'
                      onClick={() => handleDismiss(n.id)}
                      className='shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600'
                      aria-label='Dismiss'
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
