import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

interface NotificationItem {
  id: string | number
  title?: string
  message: string
}

interface NotificationProps {
  className?: string
  /**
   * Prefetched notifications can be passed directly; otherwise the component
   * will attempt to fetch them from `/api/notifications` on mount.
   */
  initialNotifications?: NotificationItem[]
}

export function Notification({
  className,
  initialNotifications = [],
}: NotificationProps) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // If notifications not provided, fetch them once on mount
    if (initialNotifications.length === 0) {
      setIsLoading(true)
      fetch('/api/notifications')
        .then(async res => {
          if (!res.ok) throw new Error('Failed to fetch notifications')
          return res.json()
        })
        .then(data => {
          if (data?.notifications) setNotifications(data.notifications)
        })
        .catch(() => {
          // Silent fail; keep empty notification list
        })
        .finally(() => setIsLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNotifications.length])

  // Poll periodically for new notifications (every 10 s)
  useEffect(() => {
    const fetchLatest = async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      if (data?.notifications) setNotifications(data.notifications)
    }

    // first call right away to catch any due notifications that appeared while component mounted
    fetchLatest()

    const interval = setInterval(fetchLatest, 1000 * 60 * 60 * 6)
    return () => clearInterval(interval)
  }, [])

  const mutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch('/api/notifications/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: (_, id) => {
      setNotifications(prev => prev.filter(n => n.id !== id))
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
