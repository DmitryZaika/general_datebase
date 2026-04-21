import type { EmailHistory } from '~/crud/emails'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'normal'

export type HistoryTab = 'all' | 'activities' | 'notes' | 'emails'

export type DealEmailHistoryItem = EmailHistory & {
  thread_has_attachments?: boolean
}

export type HistoryItem =
  | { type: 'activity'; data: DealActivity; date: string; isPinned: false }
  | { type: 'note'; data: DealNote; date: string; isPinned: boolean }
  | { type: 'email'; data: DealEmailHistoryItem; date: string; isPinned: false }

export interface DealActivityPanelProps {
  dealId: number
  activities?: DealActivity[]
  notes?: DealNote[]
  emails?: DealEmailHistoryItem[]
}
