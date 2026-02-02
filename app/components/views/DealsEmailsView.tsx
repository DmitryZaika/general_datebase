import { format } from 'date-fns'
import { Archive, File, Inbox, Paperclip, RotateCw, Send, Star } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '~/components/ui/checkbox'
import { cn } from '~/lib/utils'

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
}

interface DealsEmailsViewProps {
  emails: Email[]
  currentUserEmail: string
}

type Tab = 'inbox' | 'drafts' | 'outbox' | 'sent' | 'archive'

export default function DealsEmailsView({
  emails,
  currentUserEmail,
}: DealsEmailsViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set())

  // Filter emails based on tab
  const filteredEmails = emails.filter(email => {
    const isSender =
      email.sender_email?.toLowerCase() === currentUserEmail.toLowerCase()

    if (activeTab === 'inbox') {
      return !isSender // If not sender, then receiver (roughly)
    }
    if (activeTab === 'sent') {
      return isSender
    }
    // For now, other tabs are empty or placeholders
    return false
  })

  // Sort by date desc
  filteredEmails.sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
  )

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedEmails)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedEmails(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedEmails.size === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)))
    }
  }

  const navItems = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      count: emails.filter(
        e => e.receiver_email?.toLowerCase() === currentUserEmail.toLowerCase(),
      ).length,
    },
    { id: 'drafts', label: 'Drafts', icon: File, count: 0 },
    { id: 'outbox', label: 'Outbox', icon: Send, count: 0 },
    { id: 'sent', label: 'Sent', icon: Send, count: 0 },
    { id: 'archive', label: 'Archive', icon: Archive, count: 0 },
  ]

  return (
    <div className='flex h-[calc(100vh-100px)] w-full bg-background font-sans'>
      {/* Sidebar */}
      <div className='w-64 flex-shrink-0 flex flex-col py-4 pr-4'>
        <div className='px-4 mb-6'>
          <button
            type='button'
            className='flex items-center gap-2 bg-[#34a853] hover:bg-[#2d9147] text-white px-6 py-3 rounded-2xl font-medium shadow-sm transition-colors'
          >
            <span className='text-xl'>+</span>
            <span>New email</span>
          </button>
        </div>

        <nav className='flex-1 space-y-1 pr-2'>
          {navItems.map(item => (
            <button
              type='button'
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={cn(
                'w-full flex items-center gap-3 px-6 py-2 rounded-r-full text-sm font-medium transition-colors',
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
          <div className='pl-2'>
            <Checkbox
              checked={
                selectedEmails.size === filteredEmails.length &&
                filteredEmails.length > 0
              }
              onCheckedChange={toggleSelectAll}
              className='data-[state=checked]:bg-gray-600 data-[state=checked]:border-gray-600 border-gray-400'
            />
          </div>
          <button
            type='button'
            onClick={() => window.location.reload()}
            className='p-1 hover:bg-gray-100 rounded-full text-gray-500'
          >
            <RotateCw className='h-4 w-4' />
          </button>
        </div>

        {/* Email List */}
        <div className='flex-1 overflow-y-auto'>
          {filteredEmails.length === 0 ? (
            <div className='p-8 text-center text-muted-foreground'>
              No conversations in {activeTab}.
            </div>
          ) : (
            <div className='divide-y divide-gray-100'>
              {filteredEmails.map(email => {
                // Assuming isRead=true for now as we don't have read status per user easily available in this view yet
                // (though admin.deals has email_reads, this view is simpler for now)
                const isRead = true
                return (
                  <div
                    key={email.id}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2.5 hover:shadow-md hover:z-10 relative cursor-pointer transition-all bg-white border-b border-transparent hover:border-gray-200',
                      !isRead && 'bg-gray-50 font-semibold',
                    )}
                  >
                    {/* Checkbox & Star */}
                    <div className='flex items-center gap-3 flex-shrink-0 pl-2'>
                      <Checkbox
                        checked={selectedEmails.has(email.id)}
                        onCheckedChange={() => toggleSelect(email.id)}
                        className='data-[state=checked]:bg-gray-600 data-[state=checked]:border-gray-600 border-gray-300'
                      />
                      <Star className='h-5 w-5 text-gray-300 hover:text-yellow-400 cursor-pointer' />
                    </div>

                    {/* Sender */}
                    <div className='w-48 flex-shrink-0 truncate text-sm text-gray-900 font-medium pl-1'>
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
