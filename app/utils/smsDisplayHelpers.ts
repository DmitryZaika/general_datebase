import { MessageSquare } from 'lucide-react'
import type { Nullable } from '~/types/utils'

export type SmsDirection = 'inbound' | 'outbound'

export type SmsRow = {
  id: number
  cloudtalk_id: Nullable<number>
  sender: string
  recipient: string
  text: string
  agent: Nullable<string>
  created_date: string
  company_id: Nullable<number>
}

export type SmsEntry = {
  id: number
  direction: SmsDirection
  text: string
  agent: Nullable<string>
  customerPhone: string
  createdDate: string
}

export type SmsThread = {
  customerPhone: string
  messages: SmsEntry[]
  lastMessageAt: string
  count: number
}

export function mapRowToSmsEntry(
  row: SmsRow,
  customerPhoneDigits: readonly string[],
): SmsEntry {
  const direction: SmsDirection = customerPhoneDigits.includes(row.sender)
    ? 'inbound'
    : 'outbound'
  const customerPhone = direction === 'inbound' ? row.sender : row.recipient
  return {
    id: row.id,
    direction,
    text: row.text,
    agent: row.agent,
    customerPhone,
    createdDate: row.created_date,
  }
}

export function groupSmsIntoThreads(entries: SmsEntry[]): SmsThread[] {
  const byPhone = new Map<string, SmsEntry[]>()
  for (const e of entries) {
    const arr = byPhone.get(e.customerPhone) ?? []
    arr.push(e)
    byPhone.set(e.customerPhone, arr)
  }
  return [...byPhone.entries()]
    .map(([phone, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime(),
      )
      return {
        customerPhone: phone,
        messages: sorted,
        lastMessageAt: sorted[sorted.length - 1].createdDate,
        count: sorted.length,
      } satisfies SmsThread
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    )
}

export function getSmsIcon() {
  return { Icon: MessageSquare, color: 'text-indigo-500' }
}
