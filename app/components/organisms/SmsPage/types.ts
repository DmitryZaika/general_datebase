import type { Nullable } from '~/types/utils'

export type SmsDirection = 'inbound' | 'outbound'

export type SmsMessageStatus = 'sent' | 'sending' | 'failed'

export interface SmsMessage {
  id: string
  direction: SmsDirection
  text: string
  agent: Nullable<string>
  createdAt: string
  status: SmsMessageStatus
}

export interface SmsThread {
  phoneDigits: string
  customer: Nullable<{
    id: number
    name: string
  }>
  messages: SmsMessage[]
  unreadCount: number
  assignedToCurrentUser: boolean
}

export interface ThreadSummary {
  phoneDigits: string
  customerId: Nullable<number>
  customerName: Nullable<string>
  lastMessageText: string
  lastMessageAt: string
  lastDirection: SmsDirection
  lastAgent: Nullable<string>
  messageCount: number
  unreadCount: number
}

export interface CustomerSearchResult {
  id: number
  name: string
  phone: string
}
