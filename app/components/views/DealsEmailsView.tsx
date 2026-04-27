import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArchiveRestore,
  Eye,
  Inbox,
  Mail,
  MailOpen,
  Menu,
  Paperclip,
  PenSquare,
  RotateCw,
  Search,
  Send,
  Trash2,
  X,
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
  thread_has_attachments?: boolean | number
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

const EMPLOYEE_GMAIL_TRASH_BAR_MS = 5000
const EMPLOYEE_GMAIL_ACK_BAR_MS = 4000

type EmployeeGmailBarState =
  | { mode: 'trash'; threadIds: string[]; message: string }
  | { mode: 'ack'; message: string; instanceId: number }

function ThreadRowHoverActions({
  threadId,
  activeTab,
  isUnread,
  busy,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onRestore,
  layer = 'swap',
}: {
  threadId: string
  activeTab: Tab
  isUnread: boolean
  busy: boolean
  onDelete: (threadId: string) => void
  onMarkRead: (threadId: string) => void
  onMarkUnread: (threadId: string) => void
  onRestore: (threadId: string) => void
  layer?: 'swap' | 'overlay'
}) {
  const shellClass = cn(
    'flex items-center gap-0.5 flex-shrink-0',
    layer === 'overlay' ? 'flex' : 'max-md:flex md:hidden md:group-hover:flex',
  )

  if (activeTab === 'trash') {
    return (
      <div className={shellClass} onClick={e => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              disabled={busy}
              onClick={() => onRestore(threadId)}
              className='p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors disabled:opacity-50'
            >
              <ArchiveRestore className='h-4 w-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent side='top' sideOffset={6}>
            Undelete
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={shellClass} onClick={e => e.stopPropagation()}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            disabled={busy}
            onClick={() => onDelete(threadId)}
            className='cursor-pointer p-1.5 hover:bg-red-50 rounded-full text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          >
            <Trash2 className='h-4 w-4' />
          </button>
        </TooltipTrigger>
        <TooltipContent side='top' sideOffset={6}>
          Delete
        </TooltipContent>
      </Tooltip>
      {activeTab === 'inbox' &&
        (isUnread ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                disabled={busy}
                onClick={() => onMarkRead(threadId)}
                className='cursor-pointer p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
              >
                <MailOpen className='h-4 w-4' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='top' sideOffset={6}>
              Mark as read
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                disabled={busy}
                onClick={() => onMarkUnread(threadId)}
                className='cursor-pointer p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
              >
                <Mail className='h-4 w-4' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='top' sideOffset={6}>
              Mark as unread
            </TooltipContent>
          </Tooltip>
        ))}
    </div>
  )
}

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
  const [rowActionBusyThreadId, setRowActionBusyThreadId] = useState<string | null>(
    null,
  )
  const [employeeGmailBar, setEmployeeGmailBar] =
    useState<EmployeeGmailBarState | null>(null)
  const [undoRestoreSubmitting, setUndoRestoreSubmitting] = useState(false)
  const employeeGmailBarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gmailBarAckInstanceRef = useRef(0)
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

  const clearEmployeeGmailBarTimer = () => {
    if (employeeGmailBarTimerRef.current) {
      clearTimeout(employeeGmailBarTimerRef.current)
      employeeGmailBarTimerRef.current = null
    }
  }

  const dismissEmployeeGmailBar = () => {
    clearEmployeeGmailBarTimer()
    setEmployeeGmailBar(null)
  }

  const scheduleEmployeeGmailBarDismiss = (ms: number) => {
    clearEmployeeGmailBarTimer()
    employeeGmailBarTimerRef.current = setTimeout(() => {
      setEmployeeGmailBar(null)
      employeeGmailBarTimerRef.current = null
    }, ms)
  }

  const showEmployeeTrashUndo = (threadIds: string[]) => {
    clearEmployeeGmailBarTimer()
    const message =
      threadIds.length > 1
        ? `${threadIds.length} conversations moved to Trash.`
        : 'Conversation moved to Trash.'
    setEmployeeGmailBar({ mode: 'trash', threadIds, message })
    scheduleEmployeeGmailBarDismiss(EMPLOYEE_GMAIL_TRASH_BAR_MS)
  }

  const showActionUndoneGmailBar = () => {
    clearEmployeeGmailBarTimer()
    gmailBarAckInstanceRef.current += 1
    setEmployeeGmailBar({
      mode: 'ack',
      message: 'Action undone.',
      instanceId: gmailBarAckInstanceRef.current,
    })
    scheduleEmployeeGmailBarDismiss(EMPLOYEE_GMAIL_ACK_BAR_MS)
  }

  const restoreEmployeeTrashUndo = async () => {
    if (!employeeGmailBar || employeeGmailBar.mode !== 'trash') return
    setUndoRestoreSubmitting(true)
    try {
      const res = await fetch('/api/emails/restore-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: employeeGmailBar.threadIds }),
      })
      dismissEmployeeGmailBar()
      if (res.ok) {
        revalidator.revalidate()
        showActionUndoneGmailBar()
      } else {
        toast({
          title: 'Error',
          description: 'Could not undo.',
          variant: 'destructive',
        })
      }
    } catch {
      dismissEmployeeGmailBar()
      toast({
        title: 'Error',
        description: 'Could not undo.',
        variant: 'destructive',
      })
    } finally {
      setUndoRestoreSubmitting(false)
    }
  }

  useEffect(() => {
    return () => clearEmployeeGmailBarTimer()
  }, [])

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

  const selectedHasUnreadThreads = useMemo(() => {
    for (const threadId of selectedThreads) {
      if (unreadThreadIds.has(threadId)) {
        return true
      }
    }
    return false
  }, [selectedThreads, unreadThreadIds])

  const threadIdsWithAttachments = useMemo(() => {
    const ids = new Set<string>()
    for (const email of emails) {
      if (email.thread_has_attachments || email.has_attachments) {
        ids.add(email.thread_id)
      }
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
      adminMode &&
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
        const deletedIds = Array.from(selectedThreads)
        if (!adminMode) {
          showEmployeeTrashUndo(deletedIds)
        } else {
          toast({
            title: 'Success',
            description: 'Conversations deleted',
            variant: 'success',
          })
        }
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

  const handleToggleSelectedReadState = async () => {
    if (selectedThreads.size === 0) return
    const endpoint = selectedHasUnreadThreads
      ? '/api/emails/mark-read'
      : '/api/emails/mark-unread'
    const successDescription = selectedHasUnreadThreads
      ? 'Marked as read'
      : 'Marked as unread'
    const errorDescription = selectedHasUnreadThreads
      ? 'Failed to mark as read'
      : 'Failed to mark as unread'

    setIsMarkingUnread(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: Array.from(selectedThreads) }),
      })
      if (res.ok) {
        toast({
          title: 'Success',
          description: successDescription,
          variant: 'success',
        })
        setSelectedThreads(new Set())
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: errorDescription,
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: errorDescription,
        variant: 'destructive',
      })
    } finally {
      setIsMarkingUnread(false)
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    if (adminMode && !confirm('Delete this conversation?')) return
    setRowActionBusyThreadId(threadId)
    try {
      const res = await fetch('/api/emails/delete-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: [threadId] }),
      })
      if (res.ok) {
        if (!adminMode) {
          showEmployeeTrashUndo([threadId])
        } else {
          toast({
            title: 'Success',
            description: 'Conversation deleted',
            variant: 'success',
          })
        }
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete conversation',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      })
    } finally {
      setRowActionBusyThreadId(null)
    }
  }

  const handleMarkReadThread = async (threadId: string) => {
    setRowActionBusyThreadId(threadId)
    try {
      const res = await fetch('/api/emails/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: [threadId] }),
      })
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Marked as read',
          variant: 'success',
        })
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to mark as read',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mark as read',
        variant: 'destructive',
      })
    } finally {
      setRowActionBusyThreadId(null)
    }
  }

  const handleMarkUnreadThread = async (threadId: string) => {
    setRowActionBusyThreadId(threadId)
    try {
      const res = await fetch('/api/emails/mark-unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: [threadId] }),
      })
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Marked as unread',
          variant: 'success',
        })
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
      setRowActionBusyThreadId(null)
    }
  }

  const handleRestoreThread = async (threadId: string) => {
    setRowActionBusyThreadId(threadId)
    try {
      const res = await fetch('/api/emails/restore-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds: [threadId] }),
      })
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Conversation restored',
          variant: 'success',
        })
        revalidator.revalidate()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to restore conversation',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to restore conversation',
        variant: 'destructive',
      })
    } finally {
      setRowActionBusyThreadId(null)
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
              className='cursor-pointer'
            />
            {selectedThreads.size > 0 && activeTab !== 'trash' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className='cursor-pointer p-1.5 hover:bg-red-50 rounded-full text-red-500 transition-colors disabled:cursor-not-allowed'
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
                      onClick={handleToggleSelectedReadState}
                      disabled={isMarkingUnread}
                      className='cursor-pointer p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors disabled:cursor-not-allowed'
                    >
                      {selectedHasUnreadThreads ? (
                        <MailOpen className='h-4 w-4' />
                      ) : (
                        <Mail className='h-4 w-4' />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' sideOffset={6}>
                    {selectedHasUnreadThreads ? 'Mark as read' : 'Mark as unread'}
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
                  placeholder='Search subject, body, or addresses...'
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
                  placeholder='Search subject, body, or addresses...'
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
                  className='group relative border-b border-transparent bg-white px-3 py-1.5'
                >
                  <div className='relative z-[2] flex w-full min-w-0 items-stretch gap-3'>
                    <div className='flex shrink-0 items-center self-stretch'>
                      <Skeleton className='size-4.5 rounded' />
                    </div>
                    <div className='flex flex-1 min-w-0 flex-col gap-0.5 md:hidden'>
                      <div className='flex items-center justify-between gap-2'>
                        <Skeleton className='h-4 w-36 max-w-[65%]' />
                        <div className='flex flex-shrink-0 items-center gap-2'>
                          <Skeleton className='h-9 w-24' />
                          <Skeleton className='h-3 w-10' />
                        </div>
                      </div>
                      <Skeleton className='h-4 w-full max-w-[260px]' />
                      <Skeleton className='h-4 w-full max-w-[220px]' />
                    </div>
                    <div className='hidden min-h-9 flex-1 items-center gap-4 md:flex'>
                      {adminMode && <Skeleton className='h-4 w-32 flex-shrink-0' />}
                      <Skeleton className='h-4 w-48 flex-shrink-0' />
                      <div className='flex min-w-0 flex-1 items-center gap-2'>
                        <Skeleton className='h-4 max-w-[200px] w-[40%] flex-shrink-0' />
                        <Skeleton className='h-4 min-w-0 flex-1' />
                      </div>
                      <Skeleton className='h-9 w-24 flex-shrink-0' />
                      <Skeleton className='h-3.5 w-16 flex-shrink-0' />
                    </div>
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
                      'group relative z-0 cursor-pointer border-b border-transparent px-3 py-1.5 transition-[border-color] hover:z-20 hover:border-gray-200',
                      isUnread ? 'bg-blue-50 font-semibold' : 'bg-white',
                      isSelected && 'bg-blue-100',
                    )}
                  >
                    <span
                      className='pointer-events-none absolute inset-0 z-[1] opacity-0 shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-opacity duration-150 group-hover:opacity-100'
                      aria-hidden
                    />
                    <div className='relative z-[2] flex w-full min-w-0 items-stretch gap-3'>
                      <label
                        className='-my-1.5 flex w-8 shrink-0 cursor-pointer items-center justify-center self-stretch'
                        onClick={e => e.stopPropagation()}
                      >
                        <span className='flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-200'>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={checked => {
                              const next = new Set(selectedThreads)
                              if (checked) next.add(email.thread_id)
                              else next.delete(email.thread_id)
                              setSelectedThreads(next)
                            }}
                            className='h-4 w-4 cursor-pointer rounded-[2px] border-gray-400 bg-white shadow-none data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600'
                            onClick={e => e.stopPropagation()}
                          />
                        </span>
                      </label>

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
                            <div
                              className={cn(
                                'relative flex min-w-24 flex-shrink-0 items-center justify-end',
                                'md:h-9 md:w-24',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex items-center justify-end gap-2',
                                  'md:absolute md:inset-y-0 md:right-0 md:z-[3] md:gap-3 md:transition-opacity md:duration-150',
                                  'md:opacity-100 md:group-hover:pointer-events-none md:group-hover:opacity-0',
                                )}
                              >
                                {threadIdsWithAttachments.has(email.thread_id) && (
                                  <Paperclip className='h-3.5 w-3.5 text-gray-500' />
                                )}
                                {activeTab === 'sent' && (
                                  <span
                                    title={
                                      email.client_read_at ? 'Read by client' : 'Unread'
                                    }
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
                              </div>
                              <div
                                className={cn(
                                  'flex items-center justify-end',
                                  'md:absolute md:inset-y-0 md:right-0 md:z-[3] md:transition-opacity md:duration-150',
                                  'md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100',
                                )}
                              >
                                <ThreadRowHoverActions
                                  threadId={email.thread_id}
                                  activeTab={activeTab}
                                  isUnread={isUnread}
                                  busy={rowActionBusyThreadId === email.thread_id}
                                  onDelete={handleDeleteThread}
                                  onMarkRead={handleMarkReadThread}
                                  onMarkUnread={handleMarkUnreadThread}
                                  onRestore={handleRestoreThread}
                                  layer='overlay'
                                />
                              </div>
                            </div>
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
                          <div className='relative h-9 w-24 flex-shrink-0'>
                            <div
                              className={cn(
                                'absolute inset-y-0 right-0 z-[3] flex items-center justify-end gap-3 transition-opacity duration-150',
                                'opacity-100 group-hover:pointer-events-none group-hover:opacity-0',
                              )}
                            >
                              {threadIdsWithAttachments.has(email.thread_id) && (
                                <Paperclip className='h-3.5 w-3.5 text-gray-500' />
                              )}
                              {activeTab === 'sent' && (
                                <span
                                  title={
                                    email.client_read_at ? 'Read by client' : 'Unread'
                                  }
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
                            </div>
                            <div
                              className={cn(
                                'absolute inset-y-0 right-0 z-[3] flex items-center justify-end transition-opacity duration-150',
                                'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
                              )}
                            >
                              <ThreadRowHoverActions
                                threadId={email.thread_id}
                                activeTab={activeTab}
                                isUnread={isUnread}
                                busy={rowActionBusyThreadId === email.thread_id}
                                onDelete={handleDeleteThread}
                                onMarkRead={handleMarkReadThread}
                                onMarkUnread={handleMarkUnreadThread}
                                onRestore={handleRestoreThread}
                                layer='overlay'
                              />
                            </div>
                          </div>
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

      {!adminMode ? (
        <AnimatePresence>
          {employeeGmailBar ? (
            <motion.div
              key={
                employeeGmailBar.mode === 'trash'
                  ? employeeGmailBar.threadIds.join('\0')
                  : `ack-${employeeGmailBar.instanceId}`
              }
              role='status'
              initial={{ x: '-100vw', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100vw', opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className='fixed bottom-4 left-4 z-[60] flex max-w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 text-sm text-white shadow-lg'
            >
              <div className='flex items-center gap-3 px-4 py-3'>
                <span className='min-w-0 flex-1 leading-snug'>
                  {employeeGmailBar.message}
                </span>
                {employeeGmailBar.mode === 'trash' ? (
                  <>
                    <button
                      type='button'
                      className='shrink-0 font-medium text-[#8ab4f8] hover:text-[#aac7ff] disabled:pointer-events-none disabled:opacity-50'
                      onClick={() => void restoreEmployeeTrashUndo()}
                      disabled={undoRestoreSubmitting}
                    >
                      Undo
                    </button>
                    <button
                      type='button'
                      className='shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white'
                      onClick={dismissEmployeeGmailBar}
                      aria-label='Dismiss'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </>
                ) : (
                  <button
                    type='button'
                    className='shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white'
                    onClick={dismissEmployeeGmailBar}
                    aria-label='Dismiss'
                  >
                    <X className='h-4 w-4' />
                  </button>
                )}
              </div>
              {employeeGmailBar.mode === 'trash' ? (
                <div className='h-1 w-full shrink-0 bg-zinc-800'>
                  <motion.div
                    className='h-full w-full bg-[#8ab4f8]'
                    style={{ transformOrigin: '0% 50%' }}
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{
                      duration: EMPLOYEE_GMAIL_TRASH_BAR_MS / 1000,
                      ease: 'linear',
                    }}
                  />
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  )
}
