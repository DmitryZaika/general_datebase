import { format } from 'date-fns'
import { Inbox, Paperclip, RotateCw, Search, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useRevalidator } from 'react-router'
import { useToast } from '~/hooks/use-toast'
import { cn } from '~/lib/utils'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'

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
}

interface DealsEmailsViewProps {
  emails: Email[]
  currentUserEmail: string
  adminMode?: boolean
}

type Tab = 'inbox' | 'drafts' | 'outbox' | 'sent' | 'archive'

export default function DealsEmailsView({
  emails,
  currentUserEmail,
  adminMode = false,
}: DealsEmailsViewProps) {
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const location = useLocation()

  // Filter and group emails based on tab
  const filteredEmails = useMemo(() => {
    const threadMap = new Map<string, Email>()

    if (activeTab === 'inbox') {
      // Inbox: latest message in each thread where user is NOT the sender (or just latest message)
      emails.forEach(email => {
        const existing = threadMap.get(email.thread_id)
        if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
          threadMap.set(email.thread_id, email)
        }
      })

      return Array.from(threadMap.values()).filter(email => {
        if (adminMode) {
          return email.sender_user_id == null // Incoming from customer
        }
        return email.sender_email?.toLowerCase() !== currentUserEmail.toLowerCase()
      })
    }

    if (activeTab === 'sent') {
      // Sent: latest message in each thread where user IS the sender
      emails.forEach(email => {
        const isSender = adminMode
          ? email.sender_user_id != null
          : email.sender_email?.toLowerCase() === currentUserEmail.toLowerCase()

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
  }, [emails, activeTab, currentUserEmail, adminMode])

  // Filter by search term
  const searchedEmails = useMemo(() => {
    if (!searchTerm.trim()) return filteredEmails

    const term = searchTerm.toLowerCase()
    return filteredEmails.filter(email => {
      const subject = email.subject?.toLowerCase() || ''
      const body = email.body?.toLowerCase() || ''
      const sender = email.sender_email?.toLowerCase() || ''
      const receiver = email.receiver_email?.toLowerCase() || ''
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

  // Calculate counts for nav items
  const counts = useMemo(() => {
    const inboxThreads = new Map<string, Email>()
    const sentThreads = new Map<string, Email>()

    // Inbox count logic
    emails.forEach(email => {
      const existing = inboxThreads.get(email.thread_id)
      if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
        inboxThreads.set(email.thread_id, email)
      }
    })
    const inboxCount = Array.from(inboxThreads.values()).filter(email => {
      if (adminMode) return email.sender_user_id == null
      return email.sender_email?.toLowerCase() !== currentUserEmail.toLowerCase()
    }).length

    // Sent count logic
    emails.forEach(email => {
      const isSender = adminMode
        ? email.sender_user_id != null
        : email.sender_email?.toLowerCase() === currentUserEmail.toLowerCase()
      if (isSender) {
        const existing = sentThreads.get(email.thread_id)
        if (!existing || new Date(email.sent_at) > new Date(existing.sent_at)) {
          sentThreads.set(email.thread_id, email)
        }
      }
    })
    const sentCount = sentThreads.size

    return { inbox: inboxCount, sent: sentCount }
  }, [emails, currentUserEmail, adminMode])

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

  return (
    <div className='flex h-[calc(100vh-100px)] w-full bg-background font-sans'>
      {/* Sidebar */}
      <div className='w-64 flex-shrink-0 flex flex-col py-4 pr-4'>
        {!adminMode && (
          <Button className='w-full' onClick={() => navigate('sendEmail')}>
            New email
          </Button>
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

      {/* Main Content */}
      <div className='flex-1 flex flex-col bg-white rounded-tl-2xl shadow-sm border border-gray-200 overflow-hidden mr-4 mb-4'>
        {/* Toolbar / Header of list */}
        <div className='flex items-center gap-4 p-3 border-b border-gray-200 bg-white'>
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
          <div className='flex-1' />
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
                const isRead = true
                const isSelected = selectedThreads.has(email.thread_id)
                return (
                  <div
                    key={email.id}
                    onClick={() =>
                      navigate(`chat/${email.thread_id}${location.search}`)
                    }
                    className={cn(
                      'group flex items-center gap-3 px-2 py-2 hover:shadow-md hover:z-10 relative cursor-pointer transition-all bg-white border-b border-transparent hover:border-gray-200',
                      !isRead && 'bg-gray-50 font-semibold',
                      isSelected && 'bg-blue-50',
                    )}
                  >
                    <div className='flex-shrink-0'>
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
                    {/* Employee Name (Admin Mode) */}
                    {adminMode && (
                      <div className='w-32 flex-shrink-0 truncate text-sm text-gray-500 font-medium pl-1'>
                        {activeTab === 'inbox'
                          ? email.receiver_name || email.receiver_email
                          : email.sender_name || email.sender_email}
                      </div>
                    )}
                    <div>
                      <div className='w-48 flex-shrink-0 truncate text-sm text-gray-900 font-medium pl-1'>
                        {activeTab === 'inbox'
                          ? email.sender_name || email.sender_email
                          : email.receiver_name || email.receiver_email}
                      </div>
                    </div>
                    {/* Sender Email (Small) */}
                    <div className='w-48 flex-shrink-0 truncate text-xs text-gray-400 pl-1'>
                      {activeTab === 'inbox'
                        ? email.sender_email
                        : email.receiver_email}
                    </div>

                    {/* Subject + Body */}
                    <div className='flex-1 min-w-0 flex items-center gap-2 text-sm'>
                      <span className='font-medium text-gray-900 truncate'>
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
                    <div className='flex items-center gap-4 flex-shrink-0 text-xs text-gray-500 font-medium justify-end pr-2'>
                      {Boolean(email.has_attachments) && (
                        <Paperclip className='h-3.5 w-3.5 text-gray-500' />
                      )}
                      <span className='w-16 text-right'>
                        {format(new Date(email.sent_at), 'MMM d')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
