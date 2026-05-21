import { useQuery } from '@tanstack/react-query'
import { fetchUnreadCount } from '~/components/organisms/SmsPage/mock-service'
import { useSmsStoreInvalidation } from '~/components/organisms/SmsPage/useSmsStoreInvalidation'

export function SidebarCloudtalkBadge() {
  useSmsStoreInvalidation()

  const query = useQuery({
    queryKey: ['cloudtalk-sms-unread-count'],
    queryFn: () => fetchUnreadCount(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const count = query.data?.count ?? 0
  if (count <= 0) return null
  return (
    <span
      className='ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white'
      aria-label={`${count} unread SMS thread${count === 1 ? '' : 's'}`}
    >
      {count}
    </span>
  )
}
