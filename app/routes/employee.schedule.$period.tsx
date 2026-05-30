import { useCallback } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useRevalidator,
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import SchedulerViewFilteration from '@/components/molecules/schedule/schedular-view-filteration'
import { db } from '~/db.server'
import { SchedulerProvider } from '~/providers/scheduler-provider'
import type { Period, variants } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface Event {
  id: number
  title: string
  description?: string
  start_date: string
  end_date: string
  all_day: boolean
  color: string
  status: string
  notes?: string
  created_user_id: number
  assigned_user_id?: number
  sale_id?: number
}

const validPeriods: Period[] = ['day', 'week', 'month']

function getPeriodDates(period: Period, dateStr?: string) {
  // Parse dd-mm-yyyy format or use current date
  let currentDate = new Date()
  if (dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number)
    if (day && month && year) {
      currentDate = new Date(year, month - 1, day) // month is 0-indexed
    }
  }

  switch (period) {
    case 'day': {
      const dayStart = new Date(currentDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(currentDate)
      dayEnd.setHours(23, 59, 59, 999)
      return {
        start: dayStart,
        end: dayEnd,
        currentDateStr: formatDateStr(currentDate),
      }
    }

    case 'week': {
      const weekStart = new Date(currentDate)
      weekStart.setDate(currentDate.getDate() - currentDate.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      return {
        start: weekStart,
        end: weekEnd,
        currentDateStr: formatDateStr(weekStart),
      }
    }

    case 'month': {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      )
      monthEnd.setHours(23, 59, 59, 999)
      return {
        start: monthStart,
        end: monthEnd,
        currentDateStr: formatDateStr(monthStart),
      }
    }

    default:
      throw new Error('Invalid period')
  }
}

function getColorMap(color: string): (typeof variants)[number] {
  if (color === 'red') return 'danger'
  if (color === 'green') return 'success'
  if (color === 'yellow') return 'warning'
  return 'primary'
}

function formatDateStr(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const period = params.period as string

  // Validate the period parameter
  if (!period || !validPeriods.includes(period as Period)) {
    // Redirect to default view if invalid period
    throw redirect('/employee/schedule/month')
  }

  // Get the user
  const user = await getEmployeeUser(request)

  // Get the current date from query params or use current date
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')
  const { start, end, currentDateStr } = getPeriodDates(
    period as Period,
    dateParam || undefined,
  )

  // Fetch events for the user's company in the current timeframe
  const events = await selectMany<Event>(
    db,
    `SELECT e.id, e.title, e.description, e.start_date, e.end_date, e.all_day, 
            e.color, e.status, e.notes, e.created_user_id, e.assigned_user_id, e.sale_id
     FROM events e
     JOIN users u ON e.created_user_id = u.id
     WHERE u.company_id = ? 
       AND e.deleted_date IS NULL
       AND ((e.start_date BETWEEN ? AND ?) OR (e.end_date BETWEEN ? AND ?) OR (e.start_date <= ? AND e.end_date >= ?))
     ORDER BY e.start_date ASC`,
    [
      user.company_id,
      start.toISOString(),
      end.toISOString(),
      start.toISOString(),
      end.toISOString(),
      start.toISOString(),
      end.toISOString(),
    ],
  )

  return {
    period: period as Period,
    currentDate: currentDateStr,
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: new Date(event.start_date),
      endDate: new Date(event.end_date),
      variant: getColorMap(event.color),
      allDay: event.all_day,
      color: event.color,
      status: event.status,
      notes: event.notes,
      createdUserId: event.created_user_id,
      assignedUserId: event.assigned_user_id,
      saleId: event.sale_id,
    })),
  }
}

export default function EmployeesSchedule() {
  const { period, events, currentDate } = useLoaderData<typeof loader>()
  const token = useAuthenticityToken()
  const revalidator = useRevalidator()

  const handleDeleteEvent = useCallback(
    async (id: number) => {
      const formData = new FormData()
      formData.append('id', String(id))
      formData.append('csrf', token)

      const response = await fetch('/api/events', {
        method: 'DELETE',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete event')
      }

      revalidator.revalidate()
    },
    [token, revalidator],
  )

  return (
    <SchedulerProvider initialState={events} onDeleteEvent={handleDeleteEvent}>
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8'>
        <SchedulerViewFilteration period={period} currentDate={currentDate} />
      </div>
    </SchedulerProvider>
  )
}
