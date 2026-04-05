import type { CallEntry } from '~/components/molecules/CallHistory'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'normal'

export type HistoryTab = 'all' | 'activities' | 'notes' | 'actions'

export type HistoryItem =
  | { type: 'activity'; data: DealActivity; date: string; isPinned: false }
  | { type: 'note'; data: DealNote; date: string; isPinned: boolean }
  | { type: 'action'; data: CallEntry; date: string; isPinned: false }

export interface DealActivityPanelProps {
  dealId: number
  activities?: DealActivity[]
  notes?: DealNote[]
  actions?: CallEntry[]
}
