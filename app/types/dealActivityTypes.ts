import type { EmailHistory } from '~/crud/emails'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type { CallEntry } from '~/utils/callDisplayHelpers'
import type { SmsEntry } from '~/utils/smsDisplayHelpers'

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'normal'

export type HistoryTab = 'all' | 'activities' | 'notes' | 'actions' | 'sms' | 'emails'

export type DealEmailHistoryItem = EmailHistory & {
  thread_has_attachments?: boolean
}

export type HistoryItem =
  | { type: 'activity'; data: DealActivity; date: string; isPinned: false }
  | { type: 'note'; data: DealNote; date: string; isPinned: boolean }
  | { type: 'action'; data: CallEntry; date: string; isPinned: false }
  | { type: 'sms'; data: SmsEntry; date: string; isPinned: false }
  | { type: 'email'; data: DealEmailHistoryItem; date: string; isPinned: false }

export interface DealActivityPanelProps {
  dealId: number
  activities?: DealActivity[]
  notes?: DealNote[]
  actions?: CallEntry[]
  emails?: DealEmailHistoryItem[]
}
