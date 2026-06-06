import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import {
  AgentNotLinkedBanner,
  NoThreadSelected,
} from '~/components/organisms/SmsPage/SmsPageEmptyStates'
import { SmsThreadList } from '~/components/organisms/SmsPage/SmsThreadList'
import { fetchThreads } from '~/components/organisms/SmsPage/service'
import type { ThreadSummary } from '~/components/organisms/SmsPage/types'
import type { Nullable } from '~/types/utils'
import { getEmployeeUser } from '~/utils/session.server'
import { cloudtalkBasePath } from '~/utils/urlHelpers'

const PAGE_SIZE = 20

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    return {
      userId: user.id,
      hasCloudtalkAgent: Boolean(user.cloudtalk_agent_id),
      isAdmin: Boolean(user.is_admin || user.is_superuser),
    }
  } catch {
    throw redirect('/login')
  }
}

interface ThreadsPage {
  threads: ThreadSummary[]
  totalCount: number
  unreadCount: number
  hasMore: boolean
  nextOffset: number
}

export default function CloudTalkPage() {
  const data = useLoaderData<typeof loader>()

  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const cloudtalkBase = cloudtalkBasePath(location.pathname)
  const activePhone = (params.phoneDigits ?? null) as Nullable<string>
  const [search, setSearch] = useState('')

  const threadsQuery = useInfiniteQuery<ThreadsPage>({
    queryKey: ['cloudtalk-sms-threads', search],
    queryFn: async ({ pageParam }) => {
      const offset = (pageParam as number) ?? 0
      const result = await fetchThreads({
        scope: 'mine',
        search,
        limit: PAGE_SIZE,
        offset,
      })
      return {
        threads: result.threads,
        totalCount: result.totalCount,
        unreadCount: result.unreadCount,
        hasMore: result.hasMore,
        nextOffset: offset + result.threads.length,
      }
    },
    initialPageParam: 0,
    getNextPageParam: last => (last.hasMore ? last.nextOffset : undefined),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const threads = useMemo(
    () => threadsQuery.data?.pages.flatMap(p => p.threads) ?? [],
    [threadsQuery.data],
  )
  const hasMore = Boolean(threadsQuery.hasNextPage)

  const handleSelect = useCallback(
    (phone: string) => navigate(`${cloudtalkBase}/thread/${phone}`),
    [navigate, cloudtalkBase],
  )

  const handleLoadMore = useCallback(() => {
    if (threadsQuery.hasNextPage && !threadsQuery.isFetchingNextPage) {
      threadsQuery.fetchNextPage()
    }
  }, [threadsQuery])

  return (
    <div className='flex flex-col h-[calc(100vh-100px)] w-full bg-slate-50'>
      {!data.hasCloudtalkAgent && !data.isAdmin && <AgentNotLinkedBanner />}
      <div className='flex flex-1 min-h-0 w-full'>
        <SmsThreadList
          threads={threads}
          isLoading={threadsQuery.isLoading}
          isFetchingMore={threadsQuery.isFetchingNextPage}
          hasMore={hasMore}
          activePhoneDigits={activePhone}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          onLoadMore={handleLoadMore}
        />
        <main
          className={`${
            activePhone ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col bg-white`}
        >
          <div className='flex-1 min-h-0 bg-white'>
            {activePhone ? <Outlet /> : <NoThreadSelected />}
          </div>
        </main>
      </div>
    </div>
  )
}
