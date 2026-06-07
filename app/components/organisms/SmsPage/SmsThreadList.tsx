import { SquarePen } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { SearchInput } from '~/components/molecules/SearchInput'
import { Skeleton } from '~/components/ui/skeleton'
import { NoThreadsEmpty, SearchNoMatch, ThreadListLoading } from './SmsPageEmptyStates'
import { SmsThreadListItem } from './SmsThreadListItem'
import type { ThreadSummary } from './types'

export interface SmsThreadListProps {
  threads: ThreadSummary[]
  isLoading: boolean
  isFetchingMore: boolean
  hasMore: boolean
  activePhoneDigits: string | null
  search: string
  onSearchChange: (q: string) => void
  onSelect: (phoneDigits: string) => void
  onLoadMore: () => void
  readOnly?: boolean
  onNewConversation?: () => void
}

export function SmsThreadList(props: SmsThreadListProps) {
  const [draftSearch, setDraftSearch] = useState(props.search)
  const listboxId = useId()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (draftSearch !== props.search) {
        props.onSearchChange(draftSearch)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [draftSearch, props.search, props.onSearchChange])

  useEffect(() => {
    if (!props.hasMore || props.isLoading || props.isFetchingMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          props.onLoadMore()
        }
      },
      { root: sentinel.parentElement, rootMargin: '120px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [props.hasMore, props.isLoading, props.isFetchingMore, props.onLoadMore])

  function clearSearch() {
    setDraftSearch('')
    props.onSearchChange('')
  }

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (props.threads.length === 0) return
      const activeIndex = props.activePhoneDigits
        ? props.threads.findIndex(t => t.phoneDigits === props.activePhoneDigits)
        : -1
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next =
          activeIndex < 0 ? 0 : Math.min(activeIndex + 1, props.threads.length - 1)
        props.onSelect(props.threads[next].phoneDigits)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = activeIndex <= 0 ? 0 : activeIndex - 1
        props.onSelect(props.threads[next].phoneDigits)
      }
    },
    [props],
  )

  const showThreads = props.threads.length > 0
  const showSearchEmpty =
    !props.isLoading && !showThreads && props.search.trim().length > 0
  const showGlobalEmpty =
    !props.isLoading && !showThreads && props.search.trim().length === 0

  return (
    <aside
      className={`${
        props.activePhoneDigits ? 'hidden md:flex' : 'flex'
      } w-full md:w-80 border-r border-slate-200 bg-white flex-col h-full shrink-0`}
      aria-label='SMS conversations'
    >
      <div className='px-4 py-3 border-b border-slate-200'>
        <div className='flex items-center justify-between gap-2 mb-3'>
          <h2 className='text-base font-semibold text-slate-900'>CloudTalk SMS</h2>
          {!props.readOnly && props.onNewConversation ? (
            <button
              type='button'
              onClick={props.onNewConversation}
              aria-label='New conversation'
              className='inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm hover:bg-blue-600 transition-colors'
            >
              <SquarePen size={18} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <SearchInput
          value={draftSearch}
          onChange={setDraftSearch}
          placeholder='Search by name, phone, or message…'
          clearable
          aria-label='Search SMS conversations'
        />
      </div>

      <div
        className='flex-1 overflow-y-auto'
        role='listbox'
        id={listboxId}
        tabIndex={0}
        aria-label='SMS conversations'
        aria-activedescendant={
          props.activePhoneDigits ? `sms-thread-${props.activePhoneDigits}` : undefined
        }
        onKeyDown={handleListKeyDown}
      >
        {props.isLoading && !showThreads ? <ThreadListLoading /> : null}
        {showThreads && (
          <>
            {props.threads.map(t => (
              <SmsThreadListItem
                key={t.phoneDigits}
                thread={t}
                isActive={props.activePhoneDigits === t.phoneDigits}
                onClick={() => props.onSelect(t.phoneDigits)}
              />
            ))}
            {props.hasMore && (
              <div ref={sentinelRef} className='px-4 py-3'>
                {props.isFetchingMore ? (
                  <Skeleton className='h-12 w-full rounded-md' />
                ) : (
                  <button
                    type='button'
                    onClick={props.onLoadMore}
                    className='w-full text-xs text-blue-600 hover:underline'
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {showSearchEmpty && (
          <SearchNoMatch query={props.search} onClear={clearSearch} />
        )}
        {showGlobalEmpty && <NoThreadsEmpty />}
      </div>
    </aside>
  )
}
