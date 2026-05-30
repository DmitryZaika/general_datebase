import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import DailyView from '@/components/molecules/schedule/day-view'
import EventDetailsPanel from '@/components/molecules/schedule/event-details-panel'
import MonthView from '@/components/molecules/schedule/month-view'
import WeeklyView from '@/components/molecules/schedule/week-view'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useScheduler } from '~/providers/scheduler-provider'
import type { Period } from '~/types'

const views: Period[] = ['month']

function useIsBelowLg() {
  const [isBelowLg, setIsBelowLg] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setIsBelowLg(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isBelowLg
}

export default function SchedulerViewFilteration({
  period,
  currentDate,
}: {
  period?: Period
  currentDate?: string
}) {
  const { selectedEventId, setSelectedEventId, events } = useScheduler()
  const selectedEvent = events.events.find(event => event.id === selectedEventId)
  const isBelowLg = useIsBelowLg()

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

      <div className={cn('flex min-h-[600px]', selectedEvent && 'gap-0')}>
        <div className='min-w-0 flex-1'>
          {period === 'day' && <DailyView />}

          {period === 'week' && <WeeklyView />}

          {period === 'month' && <MonthView />}
        </div>

        {selectedEvent && (
          <aside className='hidden lg:flex w-[400px] shrink-0 border-l border-border bg-background sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-hidden rounded-r-lg'>
            <EventDetailsPanel
              event={selectedEvent}
              onClose={() => setSelectedEventId(null)}
            />
          </aside>
        )}
      </div>

      {selectedEvent && isBelowLg && (
        <Sheet
          open={true}
          onOpenChange={open => {
            if (!open) setSelectedEventId(null)
          }}
        >
          <SheetContent
            side='right'
            className='w-full sm:max-w-md p-0 [&>button]:hidden'
          >
            <EventDetailsPanel
              event={selectedEvent}
              onClose={() => setSelectedEventId(null)}
            />
          </SheetContent>
        </Sheet>
      )}

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
