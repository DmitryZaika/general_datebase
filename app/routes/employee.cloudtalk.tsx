import { useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import { CloudTalkPageSkeleton } from '~/components/organisms/SmsPage/CloudTalkPageSkeleton'
import { SmsNewConversationDialog } from '~/components/organisms/SmsPage/SmsNewConversationDialog'
import {
  AgentNotLinkedBanner,
  NoThreadSelected,
} from '~/components/organisms/SmsPage/SmsPageEmptyStates'
import { SmsThreadList } from '~/components/organisms/SmsPage/SmsThreadList'
import { fetchThreads } from '~/components/organisms/SmsPage/service'
import type { ThreadSummary } from '~/components/organisms/SmsPage/types'
import type { Nullable } from '~/types/utils'
import { companyHasCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { EMPLOYEE_VIEW_ENTER } from '~/utils/employeeViewEnterMotion'
import { getEmployeeUser } from '~/utils/session.server'
import { cloudtalkBasePath } from '~/utils/urlHelpers'

const PAGE_SIZE = 20

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    if (!(await companyHasCloudTalk(user.company_id))) {
      throw redirect('/employee/deals')
    }
    return {
      userId: user.id,
      hasCloudtalkAgent: Boolean(user.cloudtalk_agent_id),
      isAdmin: Boolean(user.is_admin || user.is_superuser),
      readOnly: false,
    }
  } catch (error) {
    if (error instanceof Response) throw error
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
  const [searchFetchPending, setSearchFetchPending] = useState(false)
  const [newConversationOpen, setNewConversationOpen] = useState(false)

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

  const handleSearchChange = useCallback((q: string) => {
    setSearch(q)
    setSearchFetchPending(true)
  }, [])

  useEffect(() => {
    if (!threadsQuery.isFetching && !threadsQuery.isPending) {
      setSearchFetchPending(false)
    }
  }, [threadsQuery.isFetching, threadsQuery.isPending])

  const isListSearchLoading = searchFetchPending

  const showPageSkeleton =
    threadsQuery.isPending && threads.length === 0 && search.trim().length === 0

  const handleSelect = useCallback(
    (phone: string) => navigate(`${cloudtalkBase}/thread/${phone}`),
    [navigate, cloudtalkBase],
  )

  const handleStartConversation = useCallback(
    (phoneDigits: string) => {
      setNewConversationOpen(false)
      navigate(`${cloudtalkBase}/thread/${phoneDigits}`)
    },
    [navigate, cloudtalkBase],
  )

  const handleLoadMore = useCallback(() => {
    if (threadsQuery.hasNextPage && !threadsQuery.isFetchingNextPage) {
      threadsQuery.fetchNextPage()
    }
  }, [threadsQuery])

  if (showPageSkeleton) {
    const skeleton = (
      <CloudTalkPageSkeleton
        readOnly={data.readOnly}
        showConversationOnMobile={Boolean(activePhone)}
      />
    )
    if (data.readOnly) return skeleton
    return (
      <motion.div className='w-full h-full' {...EMPLOYEE_VIEW_ENTER}>
        {skeleton}
      </motion.div>
    )
  }

  const page = (
    <div className='flex flex-col h-[calc(100vh-100px)] w-full bg-slate-50'>
      {data.readOnly ? (
        <div className='bg-slate-100 border-b border-slate-200 text-slate-600 px-4 py-2 text-xs text-center'>
          View only — open employee CloudTalk SMS to send messages
        </div>
      ) : null}
      {!data.hasCloudtalkAgent && !data.isAdmin && <AgentNotLinkedBanner />}
      <div className='flex flex-1 min-h-0 w-full'>
        <SmsThreadList
          threads={threads}
          isLoading={threadsQuery.isLoading}
          isSearchLoading={isListSearchLoading}
          isFetchingMore={threadsQuery.isFetchingNextPage}
          hasMore={hasMore}
          activePhoneDigits={activePhone}
          search={search}
          onSearchChange={handleSearchChange}
          onSelect={handleSelect}
          onLoadMore={handleLoadMore}
          readOnly={data.readOnly}
          onNewConversation={
            data.readOnly ? undefined : () => setNewConversationOpen(true)
          }
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
      {!data.readOnly && (
        <SmsNewConversationDialog
          open={newConversationOpen}
          onClose={() => setNewConversationOpen(false)}
          onStart={handleStartConversation}
        />
      )}
    </div>
  )

  if (data.readOnly) return page

  return (
    <motion.div className='w-full h-full' {...EMPLOYEE_VIEW_ENTER}>
      {page}
    </motion.div>
  )
}
