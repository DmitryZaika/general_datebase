import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type LoaderFunctionArgs, data as routerData, useParams } from 'react-router'
import {
  fetchThread,
  markThreadRead,
  sendSms,
} from '~/components/organisms/SmsPage/mock-service'
import { SmsConversationPane } from '~/components/organisms/SmsPage/SmsConversationPane'
import { SmsLinkCustomerDialog } from '~/components/organisms/SmsPage/SmsLinkCustomerDialog'
import type { SmsMessage, SmsThread } from '~/components/organisms/SmsPage/types'
import { useSmsStoreInvalidation } from '~/components/organisms/SmsPage/useSmsStoreInvalidation'

const PHONE_DIGITS_RE = /^\d{10,15}$/
const INITIAL_MESSAGE_PAGE = 30

export async function loader({ params }: LoaderFunctionArgs) {
  const phoneDigits = params.phoneDigits ?? ''
  if (!PHONE_DIGITS_RE.test(phoneDigits)) {
    throw routerData(
      { error: 'Invalid phone format' },
      { status: 400, statusText: 'Bad Request' },
    )
  }
  return { phoneDigits }
}

interface ThreadResponse {
  thread: SmsThread | null
  canSend: boolean
  hasOlder: boolean
}

export default function CloudTalkThread() {
  const params = useParams()
  const phoneDigits = params.phoneDigits ?? ''
  const queryClient = useQueryClient()

  useSmsStoreInvalidation()

  const [linkOpen, setLinkOpen] = useState(false)
  const [pending, setPending] = useState<SmsMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [messageLimit, setMessageLimit] = useState(INITIAL_MESSAGE_PAGE)
  const [isFetchingOlder, setIsFetchingOlder] = useState(false)
  const lastMarkedPhoneRef = useRef<string | null>(null)

  useEffect(() => {
    setMessageLimit(INITIAL_MESSAGE_PAGE)
    setPending([])
  }, [])

  const threadQuery = useQuery<ThreadResponse>({
    queryKey: ['cloudtalk-sms-thread', phoneDigits, messageLimit],
    queryFn: () => fetchThread({ phoneDigits, limit: messageLimit }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  // Skip the POST when there's nothing to mark — and only fire once per phone,
  // since `useFetcher` would otherwise re-fire on every render.
  useEffect(() => {
    if (!phoneDigits) return
    if (lastMarkedPhoneRef.current === phoneDigits) return
    const t = threadQuery.data?.thread
    if (!t || t.unreadCount === 0) return
    lastMarkedPhoneRef.current = phoneDigits
    void markThreadRead(phoneDigits).then(() => {
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-unread-count'] })
    })
  }, [phoneDigits, threadQuery.data, queryClient])

  useEffect(() => {
    if (!threadQuery.data?.thread) return
    const confirmedTexts = new Set(
      threadQuery.data.thread.messages
        .filter(m => m.direction === 'outbound' && m.status === 'sent')
        .map(m => m.text),
    )
    setPending(prev =>
      prev.filter(p => p.status === 'failed' || !confirmedTexts.has(p.text)),
    )
  }, [threadQuery.data])

  const handleSend = useCallback(
    async (text: string) => {
      const tempId = `pending-${Date.now()}`
      const optimistic: SmsMessage = {
        id: tempId,
        direction: 'outbound',
        text,
        agent: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      setPending(prev => [...prev, optimistic])
      setIsSending(true)
      try {
        await sendSms({ phoneDigits, text })
        queryClient.invalidateQueries({
          queryKey: ['cloudtalk-sms-thread', phoneDigits],
        })
        queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
      } catch {
        setPending(prev =>
          prev.map(p => (p.id === tempId ? { ...p, status: 'failed' } : p)),
        )
      } finally {
        setIsSending(false)
      }
    },
    [phoneDigits, queryClient],
  )

  const handleRetry = useCallback(
    async (messageId: string) => {
      const failed = pending.find(p => p.id === messageId)
      if (!failed) return
      setPending(prev =>
        prev.map(p => (p.id === messageId ? { ...p, status: 'sending' } : p)),
      )
      setIsSending(true)
      try {
        await sendSms({ phoneDigits, text: failed.text })
        setPending(prev => prev.filter(p => p.id !== messageId))
        queryClient.invalidateQueries({
          queryKey: ['cloudtalk-sms-thread', phoneDigits],
        })
        queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
      } catch {
        setPending(prev =>
          prev.map(p => (p.id === messageId ? { ...p, status: 'failed' } : p)),
        )
      } finally {
        setIsSending(false)
      }
    },
    [pending, phoneDigits, queryClient],
  )

  const handleLoadOlder = useCallback(async () => {
    setIsFetchingOlder(true)
    try {
      setMessageLimit(n => n + INITIAL_MESSAGE_PAGE)
    } finally {
      setTimeout(() => setIsFetchingOlder(false), 300)
    }
  }, [])

  return (
    <>
      <SmsConversationPane
        phoneDigits={phoneDigits}
        thread={threadQuery.data?.thread ?? null}
        pendingMessages={pending}
        canSend={Boolean(threadQuery.data?.canSend)}
        isLoading={threadQuery.isLoading}
        isSending={isSending}
        hasOlder={Boolean(threadQuery.data?.hasOlder)}
        isFetchingOlder={isFetchingOlder}
        onSend={handleSend}
        onRetry={handleRetry}
        onLinkCustomer={() => setLinkOpen(true)}
        onLoadOlder={handleLoadOlder}
      />
      <SmsLinkCustomerDialog
        open={linkOpen}
        phoneDigits={phoneDigits}
        onClose={() => setLinkOpen(false)}
        onLinked={() => {
          setLinkOpen(false)
          queryClient.invalidateQueries({
            queryKey: ['cloudtalk-sms-thread', phoneDigits],
          })
          queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
        }}
      />
    </>
  )
}
