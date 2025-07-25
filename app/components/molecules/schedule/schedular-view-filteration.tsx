import { useState } from 'react'
import { Link } from 'react-router'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import DailyView from '@/components/molecules/schedule/day-view'
import MonthView from '@/components/molecules/schedule/month-view'
import WeeklyView from '@/components/molecules/schedule/week-view'
import { Button } from '@/components/ui/button'
import type { Period } from '~/types'

const views: Period[] = ['month']

export default function SchedulerViewFilteration({
  period,
  currentDate,
}: {
  period?: Period
  currentDate?: string
}) {
  const [eventModalDefaults, setEventModalDefaults] = useState<
    | {
        startDate: Date
        endDate: Date
      }
    | undefined
  >(undefined)

  function handleAddEvent(selectedDay?: number) {
    // Create the start and end dates for the event
    const startDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      12,
      0,
      0,
      0,
    )

    const endDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      13,
      0,
      0,
      0,
    )

    setEventModalDefaults({ startDate, endDate })
  }

  return (
    <div className='overflow-auto'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 px-1 gap-4'>
        <div className='flex flex-wrap gap-2 order-2 sm:order-1'>
          {views.map(view => {
            const searchParams = new URLSearchParams()
            if (currentDate) {
              searchParams.set('date', currentDate)
            }
            const linkTo = `/employee/schedule/${view}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

            return (
              <Button
                variant={period === view ? 'default' : 'outline'}
                key={view}
                asChild
              >
                <Link to={linkTo} className='capitalize touch-target'>
                  {view}
                </Link>
              </Button>
            )
          })}
        </div>
        <Button
          onClick={() => handleAddEvent()}
          className='touch-target order-1 sm:order-2'
          size='sm'
        >
          Add Event
        </Button>
      </div>

      <div className='min-h-[600px]'>
        {period === 'day' && <DailyView />}

        {period === 'week' && <WeeklyView />}

        {period === 'month' && <MonthView />}
      </div>

      {eventModalDefaults && (
        <AddEventModal
          open={true}
          onOpenChange={() => setEventModalDefaults(undefined)}
          defaultValues={eventModalDefaults}
        />
      )}
    </div>
  )
}
