import type { Nullable } from '~/types/utils'

type ActivitiesIconColor = 'red' | 'yellow' | 'gray'
export interface DealCardData {
  id: number
  name: string
  amount?: Nullable<number>
  description?: Nullable<string>
  status?: Nullable<string>
  lost_reason?: Nullable<string>
  list_id: number
  position?: Nullable<number>
  due_date?: Nullable<string>
  images?: Nullable<string[]>
  has_images?: boolean
  has_email?: boolean
  sales_rep?: Nullable<string>
  is_won?: Nullable<number>
  company_name?: Nullable<string>
  nearest_activity_name?: Nullable<string>
  nearest_activity_deadline?: Nullable<string>
  nearest_activity_id?: Nullable<number>
  nearest_activity_priority?: Nullable<string>
  has_activities?: boolean
  activities_icon_color?: ActivitiesIconColor
}
