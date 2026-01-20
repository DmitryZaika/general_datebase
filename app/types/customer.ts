export type Sources = 'check-in' | 'check-list' | 'leads' | 'call-in' | 'other'

export interface Customer {
  id: number
  name: string
  address: string | null
  phone: string | null
  phone_2: string | null
  email: string | null
  company_name: string | null
  source: Sources | null
  your_message: string | null
}
