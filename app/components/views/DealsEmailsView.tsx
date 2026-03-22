import { format } from 'date-fns'
import {
  Eye,
  Inbox,
  Mail,
  Menu,
  Paperclip,
  PenSquare,
  RotateCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import { useToast } from '~/hooks/use-toast'
import { cn } from '~/lib/utils'
import { parseEmailAddress } from '~/utils/stringHelpers'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { Skeleton } from '../ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export interface Email {
  id: number
  thread_id: string
  subject: string
  body: string
  sent_at: string
  sender_email: string
  receiver_email: string
  sender_user_id?: number | null
  has_attachments?: boolean | number
  sender_name?: string | null
  receiver_name?: string | null
  sales_rep?: string | null
  employee_read_at?: string | null
  client_read_at?: string | null
}

export interface DealsEmailsViewProps {
  emails: Email[]
  currentUserEmail: string
  adminMode?: boolean
  salesReps?: { id: number; name: string }[]
  currentUserId?: number | null
  initialFolder?: 'inbox' | 'sent' | 'trash'
  inboxCount?: number
  sentCount?: number
  trashCount?: number
  totalCount?: number
  currentPage?: number
  pageSize?: number
}

type Tab = 'inbox' | 'drafts' | 'outbox' | 'sent' | 'archive' | 'trash'

export default function DealsEmailsView({
  emails,
  currentUserEmail,
  adminMode = false,
  salesReps = [],
  currentUserId = null,
  initialFolder,
  inboxCount: inboxCountProp,
  sentCount: sentCountProp,
  trashCount: trashCountProp,
  totalCount: totalCountProp,
  currentPage: currentPageProp = 1,
  pageSize: pageSizeProp = 50,
}: DealsEmailsViewProps) {
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [searchParams] = useSearchParams()
  const folderParam = searchParams.get('folder')
  const folderFromUrl =
    folderParam === 'sent' ? 'sent' : folderParam === 'trash' ? 'trash' : 'inbox'
  const searchFromUrl = searchParams.get('search') ?? ''
  const [activeTabLocal, setActiveTabLocal] = useState<Tab>('inbox')
  const activeTab = initialFolder != null ? (folderFromUrl as Tab) : activeTabLocal
  const setActiveTab = (t: Tab) => {
    if (initialFolder != null) {
      const next = new URLSearchParams(searchParams)
      next.set('folder', t)
      next.set('page', '1')
      navigate({ search: next.toString() })
    } else {
      setActiveTabLocal(t)
    }
  }
  const isServerPagination = totalCountProp !== undefined
  const [searchTermLocal, setSearchTermLocal] = useState('')
  const searchTerm = isServerPagination ? searchFromUrl : searchTermLocal
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMarkingUnread, setIsMarkingUnread] = useState(false)
  const { toast } = useToast()
  const location = useLocation()
  const navigation = useNavigation()
  const isNavigatingToChat =
    navigation.state === 'loading' && navigation.location?.pathname?.includes('/chat/')
  const isNavigatingFromChat =
    navigation.state === 'loading' && location.pathname.includes('/chat/')
  const isLoading =
    navigation.state === 'loading' && !isNavigatingToChat && !isNavigatingFromChat
  const listScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTopRef = useRef<number>(0)
  const wasOnChatRef = useRef(false)

  useEffect(() => {
    const onChat = location.pathname.includes('/chat/')
    if (wasOnChatRef.current && !onChat && savedScrollTopRef.current > 0) {
      const el = listScrollRef.current
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = savedScrollTopRef.current
          savedScrollTopRef.current = 0
        })
      }
      wasOnChatRef.current = false
    } else if (onChat) {
      wasOnChatRef.current = true
      if (savedScrollTopRef.current > 0) {
        const el = listScrollRef.current
        if (el) {
          requestAnimationFrame(() => {
            el.scrollTop = savedScrollTopRef.current
          })
        }
      }
    }
  }, [location.pathname])

  const selectedSalesRepId = searchParams.get('sales_rep')
    ? Number(searchParams.get('sales_rep'))
    : null

  // 1. ЛОГИКА НЕПРОЧИТАННЫХ СООБЩЕНИЙ
  // Мы проверяем ВСЕ письма, а не только последние в треде.
  // Если в треде есть хоть одно письмо от клиента без employee_read_at -> тред непрочитан.
  const unreadThreadIds = useMemo(() => {
    const ids = new Set<string>()
    emails.forEach(email => {
      // Проверка: Отправитель - клиент (нет sender_user_id) И поле прочитано пустое
      const isFromCustomer = !email.sender_user_id
      const isNotRead = !email.employee_read_at

      if (isFromCustomer && isNotRead) {
        ids.add(email.thread_id)
      }
    })
    return ids
  }, [emails])

  const threadIdsWithAttachments = useMemo(() => {
    const ids = new Set<string>()
    for (const email of emails) {
      if (email.has_attachments) ids.add(email.thread_id)
    }
    return ids
  }, [emails])

  // Filter and group emails based on tab
  const filteredEmails = useMemo(() => {
    const threadMap = new Map<string, Email>()

    if (activeTab === 'inbox') {
      const isFromCustomer = (e: Email) => e.sender_user_id == null

      const latestByThread = new Map<string, Email>()
      emails.forEach(email => {
        const existing = latestByThread.get(email.thread_id)
        if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
          latestByThread.set(email.thread_id, email)
        }
      })

      const latestIncomingByThread = new Map<string, Email>()
      emails.forEach(email => {
        if (!isFromCustomer(email)) return
        const existing = latestIncomingByThread.get(email.thread_id)
        if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
          latestIncomingByThread.set(email.thread_id, email)
        }
      })

      return Array.from(latestByThread.entries())
        .filter(([, latest]) => {
          if (isFromCustomer(latest)) return true
          return latestIncomingByThread.has(latest.thread_id)
        })
        .map(([, latest]) => {
          if (isFromCustomer(latest)) return latest
          return latestIncomingByThread.get(latest.thread_id) ?? latest
        })
    }

    if (activeTab === 'sent') {
      emails.forEach(email => {
        const isSender = adminMode
          ? selectedSalesRepId != null
            ? email.sender_user_id === selectedSalesRepId
            : email.sender_user_id != null
          : (currentUserId != null && email.sender_user_id === currentUserId) ||
            parseEmailAddress(email.sender_email).toLowerCase() ===
              parseEmailAddress(currentUserEmail).toLowerCase()

        if (isSender) {
          const existing = threadMap.get(email.thread_id)
          if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
            threadMap.set(email.thread_id, email)
          }
        }
      })
      return Array.from(threadMap.values())
    }

    if (activeTab === 'trash') {
      emails.forEach(email => {
        const existing = threadMap.get(email.thread_id)
        if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
          threadMap.set(email.thread_id, email)
        }
      })
      return Array.from(threadMap.values())
    }

    return []
  }, [
    emails,
    activeTab,
    currentUserEmail,
    currentUserId,
    adminMode,
    selectedSalesRepId,
  ])

  const searchedEmails = useMemo(() => {
    if (isServerPagination) return filteredEmails

    if (!searchTermLocal.trim()) return filteredEmails

    const term = searchTermLocal.toLowerCase()
    return filteredEmails.filter(email => {
      const subject = email.subject?.toLowerCase() || ''
      const body = email.body?.toLowerCase() || ''
      const sender = parseEmailAddress(email.sender_email).toLowerCase() || ''
      const receiver = parseEmailAddress(email.receiver_email).toLowerCase() || ''
      const senderName = email.sender_name?.toLowerCase() || ''
      const receiverName = email.receiver_name?.toLowerCase() || ''

      return (
        subject.includes(term) ||
        body.includes(term) ||
        sender.includes(term) ||
        receiver.includes(term) ||
        senderName.includes(term) ||
        receiverName.includes(term)
      )
    })
  }, [filteredEmails, searchTermLocal, isServerPagination])

  // Sort by date desc
  const sortedEmails = useMemo(() => {
    return [...searchedEmails].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
    )
  }, [searchedEmails])

  // Calculate counts for nav items (same logic as filtered lists)
  const counts = useMemo(() => {
    const isFromCustomer = (e: Email) => e.sender_user_id == null
    const latestByThread = new Map<string, Email>()
    emails.forEach(email => {
      const existing = latestByThread.get(email.thread_id)
      if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
        latestByThread.set(email.thread_id, email)
      }
    })
    const latestIncomingByThread = new Set<string>()
    emails.forEach(email => {
      if (!isFromCustomer(email)) return
      latestIncomingByThread.add(email.thread_id)
    })
    const inboxThreads = new Set<string>()
    latestByThread.forEach((latest, threadId) => {
      if (isFromCustomer(latest)) inboxThreads.add(threadId)
      else if (latestIncomingByThread.has(threadId)) inboxThreads.add(threadId)
    })

    const sentThreads = new Set<string>()
    emails.forEach(email => {
      const isSender = adminMode
        ? selectedSalesRepId != null
          ? email.sender_user_id === selectedSalesRepId
          : email.sender_user_id != null
        : (currentUserId != null && email.sender_user_id === currentUserId) ||
          parseEmailAddress(email.sender_email).toLowerCase() ===
            parseEmailAddress(currentUserEmail).toLowerCase()
      if (isSender) {
        sentThreads.add(email.thread_id)
      }
    })

    return { inbox: inboxThreads.size, sent: sentThreads.size }
  }, [emails, currentUserEmail, currentUserId, adminMode, selectedSalesRepId])

  const inboxCount = inboxCountProp !== undefined ? inboxCountProp : counts.inbox
  const sentCount = sentCountProp !== undefined ? sentCountProp : counts.sent
  const trashCount = trashCountProp !== undefined ? trashCountProp : 0

  const navItems = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      count: inboxCount,
    },
    { id: 'sent', label: 'Sent', icon: Send, count: sentCount },
    { id: 'trash', label: 'Trash', icon: Trash2, count: trashCount },
  ]

  const toggleSelectAll = () => {
    if (selectedThreads.size === sortedEmails.length && sortedEmails.length > 0) {
      setSelectedThreads(new Set())
    } else {
      setSelectedThreads(new Set(sortedEmails.map(e => e.thread_id)))
    }
  }

  const handleDelete = async () => {
    if (selectedThreads.size === 0) return
    if (
      !confirm(`Are you sure you want to delete ${selectedThreads.size} conversations?`)
    )
      return

    setIsDeleting(true)
    try {
      const res = await fetch('/api/emails/delete-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: Array.from(selectedThreads) }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Conversations deleted',
          variant: 'success',
        })
        setSelectedThreads(new Set())
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete conversations',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete conversations',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMarkUnread = async () => {
    if (selectedThreads.size === 0) return
    setIsMarkingUnread(true)
    try {
      const res = await fetch('/api/emails/mark-unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: Array.from(selectedThreads) }),
      })
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Marked as unread',
          variant: 'success',
        })
        setSelectedThreads(new Set())
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to mark as unread',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mark as unread',
        variant: 'destructive',
      })
    } finally {
      setIsMarkingUnread(false)
    }
  }

  const salesRepParam = searchParams.get('sales_rep')

  const handleSalesRepChange = (val: string) => {
    const params = new URLSearchParams(searchParams)
    if (val === 'all') {
      params.delete('sales_rep')
    } else {
      params.set('sales_rep', val)
    }
    navigate({ search: params.toString() })
  }

  const SidebarContent = () => (
    <div className='flex flex-col h-full py-4 pr-4'>
      {!adminMode ? (
        <Button className='w-full' onClick={() => navigate('sendEmail')}>
          New email
        </Button>
      ) : (
        <div className='flex items-center gap-4'>
          <Select value={salesRepParam || 'all'} onValueChange={handleSalesRepChange}>
            <SelectTrigger className='w-full bg-white'>
              <SelectValue placeholder='Select Sales Rep' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Sales Reps</SelectItem>
              {salesReps.map(rep => (
                <SelectItem key={rep.id} value={String(rep.id)}>
                  {rep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <nav className='flex-1 space-y-1 pr-2 mt-4'>
        {navItems.map(item => (
          <button
            type='button'
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as Tab)
              setSelectedThreads(new Set())
            }}
            className={cn(
              'w-full flex items-center gap-3 px-6 py-2 rounded-r-full text-sm font-medium transition-colors cursor-pointer',
              activeTab === item.id
                ? 'bg-[#e8f0fe] text-[#1967d2]'
                : 'text-gray-700 hover:bg-gray-100',
            )}
          >
            <item.icon
              className={cn(
                'h-4 w-4',
                activeTab === item.id ? 'text-[#1967d2]' : 'text-gray-500',
              )}
            />
            <span className='flex-1 text-left'>{item.label}</span>
            {item.count > 0 && (
              <span className='text-xs font-semibold'>{item.count}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )

  return (
    <div className='flex h-[calc(100vh-100px)] w-full bg-background font-sans relative'>
      {/* Desktop Sidebar */}
      <div className='hidden md:flex w-64 flex-shrink-0 flex-col'>
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className='flex-1 flex flex-col bg-white md:rounded-tl-2xl shadow-sm border border-gray-200 overflow-hidden md:mr-4 md:mb-4 h-full'>
        {/* Toolbar / Header of list */}
        <div className='flex items-center gap-2 md:gap-4 p-2 md:p-3 border-b border-gray-200 bg-white'>
          {/* Mobile Menu Trigger */}
          <div className='md:hidden'>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <Menu className='h-5 w-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='left' className='w-64 p-0 bg-white'>
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
          <div className='pl-2 flex items-center gap-2'>
            <Checkbox
              checked={
                selectedThreads.size === sortedEmails.length && sortedEmails.length > 0
              }
              onCheckedChange={toggleSelectAll}
            />
            {selectedThreads.size > 0 && activeTab !== 'trash' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className='p-1.5 hover:bg-red-50 rounded-full text-red-500 transition-colors'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' sideOffset={6}>
                    Delete selected
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleMarkUnread}
                      disabled={isMarkingUnread}
                      className='p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors'
                    >
                      <Mail className='h-4 w-4' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' sideOffset={6}>
                    Mark as unread
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          <div className='relative flex-1 max-w-md ml-2'>
            {isServerPagination ? (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const q =
                    (
                      form.elements.namedItem('search') as HTMLInputElement
                    )?.value?.trim() ?? ''
                  const next = new URLSearchParams(searchParams)
                  if (q) next.set('search', q)
                  else next.delete('search')
                  next.set('page', '1')
                  navigate({ search: next.toString() })
                }}
                className='relative'
              >
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-gray-500' />
                <Input
                  name='search'
                  type='text'
                  placeholder='Search emails...'
                  defaultValue={searchFromUrl}
                  key={searchFromUrl}
                  className='pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors'
                />
              </form>
            ) : (
              <>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-gray-500' />
                <Input
                  type='text'
                  placeholder='Search emails...'
                  value={searchTermLocal}
                  onChange={e => setSearchTermLocal(e.target.value)}
                  className='pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors'
                />
              </>
            )}
          </div>
          <div className='flex-1 md:hidden' /> {/* Spacer for mobile */}
          <button
            type='button'
            onClick={() => revalidator.revalidate()}
            className='p-1 hover:bg-gray-100 rounded-full text-gray-500'
          >
            <RotateCw
              className={cn(
                'h-4 w-4',
                revalidator.state === 'loading' && 'animate-spin',
              )}
            />
          </button>
        </div>

        {/* Email List */}
        <div ref={listScrollRef} className='flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='divide-y divide-gray-100'>
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className='flex items-start md:items-center gap-3 px-3 py-3'
                >
                  <Skeleton className='h-4.5 w-4.5 flex-shrink-0 rounded' />
                  <div className='flex-1 min-w-0 flex flex-col gap-2 md:hidden'>
                    <div className='flex justify-between gap-2'>
                      <Skeleton className='h-4 w-28' />
                      <Skeleton className='h-3 w-12' />
                    </div>
                    <Skeleton className='h-4 w-full max-w-[200px]' />
                    <Skeleton className='h-3 w-full max-w-[160px]' />
                  </div>
                  <div className='hidden md:flex flex-1 items-center gap-4 min-w-0'>
                    <Skeleton className='h-4 w-32 flex-shrink-0' />
                    <Skeleton className='h-4 w-48 flex-shrink-0' />
                    <Skeleton className='h-4 flex-1 max-w-[200px]' />
                    <Skeleton className='h-4 w-16 flex-shrink-0' />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedEmails.length === 0 ? (
            <div className='p-8 text-center text-muted-foreground'>
              {searchTerm
                ? 'No emails found matching your search.'
                : `No conversations in ${activeTab}.`}
            </div>
          ) : (
            <div className='divide-y divide-gray-100'>
              {sortedEmails.map(email => {
                // 2. ИСПОЛЬЗОВАНИЕ ЛОГИКИ
                // Тред непрочитан, если мы в Inbox и ID треда есть в списке непрочитанных
                const isUnread =
                  activeTab === 'inbox' && unreadThreadIds.has(email.thread_id)

                const isSelected = selectedThreads.has(email.thread_id)
                const senderName =
                  activeTab === 'inbox' || activeTab === 'trash'
                    ? email.sender_name || email.sender_email
                    : email.receiver_name || email.receiver_email

                return (
                  <div
                    key={email.id}
                    onClick={() => {
                      if (listScrollRef.current)
                        savedScrollTopRef.current = listScrollRef.current.scrollTop
                      navigate(`chat/${email.thread_id}${location.search}`)
                    }}
                    className={cn(
                      'group flex items-start md:items-center gap-3 px-3 py-3 hover:shadow-md hover:z-10 relative cursor-pointer transition-all border-b border-transparent hover:border-gray-200',
                      // Стили для непрочитанного сообщения: синий фон, жирный шрифт
                      isUnread ? 'bg-blue-50 font-semibold' : 'bg-white',
                      isSelected && 'bg-blue-100', // Приоритет выделения
                    )}
                  >
                    <div className='flex-shrink-0 mt-1 md:mt-0'>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={checked => {
                          const next = new Set(selectedThreads)
                          if (checked) next.add(email.thread_id)
                          else next.delete(email.thread_id)
                          setSelectedThreads(next)
                        }}
                        className='size-4.5'
                        onClick={e => e.stopPropagation()}
                      />
                    </div>

                    {/* Mobile Layout (Vertical Stack) */}
                    <div className='flex-1 min-w-0 flex flex-col gap-0.5 md:hidden'>
                      <div className='flex items-center justify-between gap-2'>
                        <span
                          className={cn(
                            'truncate text-sm',
                            isUnread
                              ? 'font-bold text-gray-900'
                              : 'font-semibold text-gray-900',
                          )}
                        >
                          {senderName}
                        </span>
                        <div className='flex items-center gap-2 flex-shrink-0'>
                          {threadIdsWithAttachments.has(email.thread_id) && (
                            <Paperclip className='h-3.5 w-3.5 text-gray-500' />
                          )}
                          {activeTab === 'sent' && (
                            <span
                              title={email.client_read_at ? 'Read by client' : 'Unread'}
                              aria-label={
                                email.client_read_at ? 'Read by client' : 'Unread'
                              }
                            >
                              <Eye
                                className={cn(
                                  'h-3.5 w-3.5 flex-shrink-0',
                                  email.client_read_at
                                    ? 'text-blue-500'
                                    : 'text-gray-400',
                                )}
                              />
                            </span>
                          )}
                          <span
                            className={cn(
                              'text-xs whitespace-nowrap',
                              isUnread ? 'text-blue-600 font-bold' : 'text-gray-500',
                            )}
                          >
                            {format(new Date(email.sent_at), 'MMM d')}
                          </span>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'text-sm truncate',
                          isUnread
                            ? 'font-bold text-gray-900'
                            : 'font-medium text-gray-900',
                        )}
                      >
                        {email.subject || '(No Subject)'}
                      </div>

                      <div className='text-sm text-gray-500 truncate'>
                        {email.body
                          ? email.body.replace(/<[^>]*>?/gm, '').slice(0, 100)
                          : ''}
                      </div>

                      {/* Admin Mode Extra Info */}
                      {adminMode && (
                        <div className='mt-1 text-xs text-gray-400 truncate'>
                          {activeTab === 'inbox' || activeTab === 'trash'
                            ? `To: ${email.receiver_name || email.receiver_email}`
                            : `From: ${email.sender_name || email.sender_email}`}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout (Horizontal Row) */}
                    <div className='hidden md:flex flex-1 items-center gap-4 min-w-0'>
                      {/* Employee Name (Admin Mode) */}
                      {adminMode && (
                        <div className='w-32 flex-shrink-0 truncate text-sm text-gray-500 font-medium'>
                          {activeTab === 'inbox' || activeTab === 'trash'
                            ? email.receiver_name
                            : email.sender_name}
                        </div>
                      )}

                      {/* Sender/Receiver Name */}
                      <div
                        className={cn(
                          'w-48 flex-shrink-0 truncate text-sm',
                          isUnread
                            ? 'font-bold text-gray-900'
                            : 'font-medium text-gray-900',
                        )}
                      >
                        {senderName}
                      </div>

                      {/* Subject + Body */}
                      <div className='flex-1 min-w-0 flex items-center gap-2 text-sm'>
                        <span
                          className={cn(
                            'truncate max-w-[200px]',
                            isUnread
                              ? 'font-bold text-gray-900'
                              : 'font-medium text-gray-900',
                          )}
                        >
                          {email.subject || '(No Subject)'}
                        </span>
                        <span className='text-gray-400'>-</span>
                        <span className='text-gray-500 truncate'>
                          {email.body
                            ? email.body.replace(/<[^>]*>?/gm, '').slice(0, 100)
                            : ''}
                        </span>
                      </div>

                      {/* Attachments & Date */}
                      <div className='flex items-center gap-4 flex-shrink-0 text-xs text-gray-500 font-medium justify-end'>
                        {threadIdsWithAttachments.has(email.thread_id) && (
                          <Paperclip className='h-3.5 w-3.5 text-gray-500' />
                        )}
                        {activeTab === 'sent' && (
                          <span
                            title={email.client_read_at ? 'Read by client' : 'Unread'}
                            aria-label={
                              email.client_read_at ? 'Read by client' : 'Unread'
                            }
                          >
                            <Eye
                              className={cn(
                                'h-4 w-4 flex-shrink-0',
                                email.client_read_at
                                  ? 'text-blue-500'
                                  : 'text-gray-400',
                              )}
                            />
                          </span>
                        )}
                        <span
                          className={cn(
                            'w-16 text-right',
                            isUnread ? 'font-bold text-blue-600' : '',
                          )}
                        >
                          {format(new Date(email.sent_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {isServerPagination && totalCountProp != null && pageSizeProp != null && (
          <div className='flex items-center justify-between gap-4 px-3 py-2 border-t border-gray-200 bg-gray-50'>
            <Button
              variant='outline'
              size='sm'
              disabled={currentPageProp <= 1}
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('page', String(currentPageProp - 1))
                navigate({ search: next.toString() })
              }}
            >
              Previous
            </Button>
            <span className='text-sm text-gray-600'>
              Page {currentPageProp} of{' '}
              {Math.max(1, Math.ceil(totalCountProp / pageSizeProp))}
              {totalCountProp > 0 && (
                <span className='ml-1'>
                  ({totalCountProp} conversation{totalCountProp !== 1 ? 's' : ''})
                </span>
              )}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={currentPageProp >= Math.ceil(totalCountProp / pageSizeProp)}
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('page', String(currentPageProp + 1))
                navigate({ search: next.toString() })
              }}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Mobile FAB for New Email */}
      {!adminMode && (
        <Button
          className='md:hidden fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg z-50 flex items-center justify-center p-0'
          onClick={() => navigate('sendEmail')}
        >
          <PenSquare className='h-6 w-6' />
        </Button>
      )}
    </div>
  )
}
