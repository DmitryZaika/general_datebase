import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
  useParams,
} from 'react-router'
import { fetchThreads, MOCK_SESSION } from '~/components/organisms/SmsPage/mock-service'
import {
  AgentNotLinkedBanner,
  NoThreadSelected,
} from '~/components/organisms/SmsPage/SmsPageEmptyStates'
import { SmsThreadList } from '~/components/organisms/SmsPage/SmsThreadList'
import type { ThreadSummary } from '~/components/organisms/SmsPage/types'
import { useSmsStoreInvalidation } from '~/components/organisms/SmsPage/useSmsStoreInvalidation'
import { getEmployeeUser } from '~/utils/session.server'

const PAGE_SIZE = 20

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await getEmployeeUser(request)
    return { ok: true }
  } catch (error) {
    throw redirect(`/login?error=${error}`)
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
  useLoaderData<typeof loader>()
  useSmsStoreInvalidation()

  const params = useParams()
  const navigate = useNavigate()
  const activePhone = (params.phoneDigits ?? null) as string | null
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
    (phone: string) => navigate(`/employee/cloudtalk/thread/${phone}`),
    [navigate],
  )

  const handleLoadMore = useCallback(() => {
    if (threadsQuery.hasNextPage && !threadsQuery.isFetchingNextPage) {
      threadsQuery.fetchNextPage()
    }
  }, [threadsQuery])

  return (
    <div className='flex h-[calc(100vh-100px)] w-full bg-slate-50'>
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
      <main className='flex-1 flex flex-col bg-white'>
        {!MOCK_SESSION.isAgentLinked && <AgentNotLinkedBanner />}
        {/* pb-20 clears the global AI Chat icon's footprint (fixed bottom-5 right-5). */}
        <div className='flex-1 pb-20 min-h-0 bg-white'>
          {activePhone ? <Outlet /> : <NoThreadSelected />}
        </div>
      </main>
    </div>
  )
}
