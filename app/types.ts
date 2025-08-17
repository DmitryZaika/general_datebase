import type { Dispatch } from 'react'

// Define scheduler state interface
export interface SchedulerState {
  events: Event[]
}

export interface Todo {
  id: number
  rich_text: string
  is_done: number
  position: number
  created_date: string
}
export interface Sink {
  id: number
  name: string
  type: string
  retail_price: number
  sink_count: number
  available: number
}

export interface Stone {
  id: number
  type: string
  name: string
  retail_price: number
}

export interface StoneImage {
  id: number
  name: string
  url: string
  type: string
  retail_price: number
  cost_per_sqft: number
  available: number
}

export type StoneSlim = Omit<Stone, 'retail_price'>

export interface Faucet {
  id: number
  name: string
  type: string
  retail_price: number
  faucet_count: number
  available: number
}

export interface InstructionSlim {
  id: number
  title: string | null
  rich_text: string
}

export interface Instruction extends InstructionSlim {
  parent_id: number | null
  after_id: number | null
  children?: Instruction[]
}

export interface HeaderProps {
  user: object | null
  isAdmin: boolean
  isSuperUser: boolean
  isEmployee?: boolean
}

export interface TokenSet {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
  x_refresh_token_expires_in: number
}

export interface Customer {
  id: number
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
}

export interface StoneSearchResult {
  id: number
  type: string
  width: number
  length: number
  name: string
  url: string
  retail_price: number
  cost_per_sqft: number
  available: number
  amount: number
  is_display: boolean
}
export type Action =
  | { type: 'ADD_EVENT'; payload: Event }
  | { type: 'REMOVE_EVENT'; payload: { id: number } }
  | { type: 'UPDATE_EVENT'; payload: Event }
  | { type: 'SET_EVENTS'; payload: Event[] }

// Define handlers interface
export interface Handlers {
  handleEventStyling: (
    event: Event,
    dayEvents: Event[],
    periodOptions?: {
      eventsInSamePeriod?: number
      periodIndex?: number
      adjustForPeriod?: boolean
    },
  ) => {
    height: string
    left: string
    maxWidth: string
    minWidth: string
    top: string
    zIndex: number
  }
  handleAddEvent: (event: Event) => void
  handleUpdateEvent: (event: Event, id: number) => void
  handleDeleteEvent: (id: number) => void
}

// Define getters interface
export interface Getters {
  getDaysInMonth: (month: number, year: number) => { day: number; events: Event[] }[]
  getEventsForDay: (day: number, currentDate: Date) => Event[]
  getDaysInWeek: (week: number, year: number) => Date[]
  getWeekNumber: (date: Date) => number
  getDayName: (day: number) => string
}

// Define the context value interface
export interface SchedulerContextType {
  events: SchedulerState
  dispatch: Dispatch<Action>
  getters: Getters
  handlers: Handlers
  weekStartsOn: startOfWeek
}

// Define the variant options
export const variants = ['success', 'primary', 'default', 'warning', 'danger'] as const

export type Variant = (typeof variants)[number]

// Event interface matching database schema
export interface Event {
  id: number
  title: string
  description?: string
  startDate: Date
  endDate: Date
  variant?: Variant
  allDay?: boolean
  color?: string
  status?: string
  notes?: string
  createdUserId?: number
  assignedUserId?: number
  saleId?: number
}

export type Views = {
  mobileViews?: string[]
  views?: string[]
}

export type startOfWeek = 'sunday' | 'monday'

export interface ButtonClassNames {
  prev?: string
  next?: string
  addEvent?: string
}

export interface TabClassNames {
  view?: string
}

export interface TabsClassNames {
  cursor?: string
  panel?: string
  tab?: string
  tabContent?: string
  tabList?: string
  wrapper?: string
}

export type Period = 'day' | 'week' | 'month'
