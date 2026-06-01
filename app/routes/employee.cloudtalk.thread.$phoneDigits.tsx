import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type LoaderFunctionArgs, data as routerData, useParams } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { SmsConversationPane } from '~/components/organisms/SmsPage/SmsConversationPane'
import { SmsLinkCustomerDialog } from '~/components/organisms/SmsPage/SmsLinkCustomerDialog'
import {
  fetchThread,
  markThreadRead,
  sendSms,
} from '~/components/organisms/SmsPage/service'
import type { SmsMessage, SmsThread } from '~/components/organisms/SmsPage/types'
import type { Nullable } from '~/types/utils'
import { PHONE_DIGITS_REGEX } from '~/utils/phone'

const INITIAL_MESSAGE_PAGE = 30

export async function loader({ params }: LoaderFunctionArgs) {
  const phoneDigits = params.phoneDigits ?? ''
  if (!PHONE_DIGITS_REGEX.test(phoneDigits)) {
    throw routerData(
      { error: 'Invalid phone format' },
      { status: 400, statusText: 'Bad Request' },
    )
  }
  return { phoneDigits }
}

interface ThreadResponse {
  thread: Nullable<SmsThread>
  canSend: boolean
  hasOlder: boolean
}

export default function CloudTalkThread() {
  const params = useParams()
  const phoneDigits = params.phoneDigits ?? ''
  const queryClient = useQueryClient()
  const csrfToken = useAuthenticityToken()

  const [linkOpen, setLinkOpen] = useState(false)
  const [pending, setPending] = useState<SmsMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [messageLimit, setMessageLimit] = useState(INITIAL_MESSAGE_PAGE)
  const [isFetchingOlder, setIsFetchingOlder] = useState(false)
  const lastMarkedPhoneRef = useRef<Nullable<string>>(null)

  useEffect(() => {
    setMessageLimit(INITIAL_MESSAGE_PAGE)
    setPending([])
  }, [phoneDigits])

  const threadQuery = useQuery<ThreadResponse>({
    queryKey: ['cloudtalk-sms-thread', phoneDigits, messageLimit],
    queryFn: () => fetchThread({ phoneDigits, limit: messageLimit }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  // Fire mark-read at most once per phone, only when there's actually
  // something unread — guards against React-Router re-firing on every render.
  useEffect(() => {
    if (!phoneDigits) return
    if (lastMarkedPhoneRef.current === phoneDigits) return
    const t = threadQuery.data?.thread
    if (!t || t.unreadCount === 0) return
    lastMarkedPhoneRef.current = phoneDigits
    void markThreadRead(phoneDigits, csrfToken).then(() => {
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-unread-count'] })
    })
  }, [phoneDigits, threadQuery.data, queryClient, csrfToken])

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
        await sendSms({ phoneDigits, text, csrfToken })
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
    [phoneDigits, queryClient, csrfToken],
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
        await sendSms({ phoneDigits, text: failed.text, csrfToken })
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
    [pending, phoneDigits, queryClient, csrfToken],
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
