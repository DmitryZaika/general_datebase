import { format } from 'date-fns'
import {
  Eye,
  Inbox,
  Menu,
  Paperclip,
  PenSquare,
  RotateCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useRevalidator, useSearchParams } from 'react-router'
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

interface DealsEmailsViewProps {
  emails: Email[]
  currentUserEmail: string
  adminMode?: boolean
  salesReps?: { id: number; name: string }[]
  currentUserId?: number | null
}

type Tab = 'inbox' | 'drafts' | 'outbox' | 'sent' | 'archive'

export default function DealsEmailsView({
  emails,
  currentUserEmail,
  adminMode = false,
  salesReps = [],
  currentUserId = null,
}: DealsEmailsViewProps) {
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const location = useLocation()
  const [searchParams] = useSearchParams()
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

    return []
  }, [
    emails,
    activeTab,
    currentUserEmail,
    currentUserId,
    adminMode,
    selectedSalesRepId,
  ])

  // Filter by search term
  const searchedEmails = useMemo(() => {
    if (!searchTerm.trim()) return filteredEmails

    const term = searchTerm.toLowerCase()
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
  }, [filteredEmails, searchTerm])

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

  const navItems = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      count: counts.inbox,
    },
    { id: 'sent', label: 'Sent', icon: Send, count: counts.sent },
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
            {selectedThreads.size > 0 && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className='p-1.5 hover:bg-red-50 rounded-full text-red-500 transition-colors'
                title='Delete selected'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            )}
          </div>
          <div className='relative flex-1 max-w-md ml-2'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-gray-500' />
            <Input
              type='text'
              placeholder='Search emails...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors'
            />
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
        <div className='flex-1 overflow-y-auto'>
          {sortedEmails.length === 0 ? (
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
                  activeTab === 'inbox'
                    ? email.sender_name || email.sender_email
                    : email.receiver_name || email.receiver_email

                return (
                  <div
                    key={email.id}
                    onClick={() => {
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
                          {Boolean(email.has_attachments) && (
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
                          {activeTab === 'inbox'
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
                          {activeTab === 'inbox'
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
                        {Boolean(email.has_attachments) && (
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
