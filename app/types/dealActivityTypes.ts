import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'normal'

export type HistoryTab = 'all' | 'activities' | 'notes'

export type HistoryItem =
  | { type: 'activity'; data: DealActivity; date: string; isPinned: false }
  | { type: 'note'; data: DealNote; date: string; isPinned: boolean }

export interface DealActivityPanelProps {
  dealId: number
  activities?: DealActivity[]
  notes?: DealNote[]
}
