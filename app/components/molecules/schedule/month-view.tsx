import clsx from 'clsx'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import DayEventsModal from '@/components/molecules/schedule/day-events-modal'
import EventStyled from '@/components/molecules/schedule/event-styled'
import { Button } from '@/components/ui/button'
import { useScheduler, type variants } from '~/providers/scheduler-provider'

// Define Event interface locally since it's not exported from types
interface Event {
  id: number
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: (typeof variants)[number]
  color?: string
  notes?: string
  allDay?: boolean
}

const MAX_VISIBLE_EVENTS = 4

const pageTransitionVariants: Variants = {
  enter: () => ({
    opacity: 0,
  }),
  center: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: 'easeInOut' },
    },
  },
}

// Helper function to format date as dd-mm-yyyy
function formatDateStr(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export default function MonthView() {
  const { getters, weekStartsOn, setSelectedEventId } = useScheduler()
  const [open, setOpen] = useState<{ startDate: Date; endDate: Date } | null>(null)
  const [dayEventsModal, setDayEventsModal] = useState<{
    date: Date
    events: Event[]
  } | null>(null)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [direction, setDirection] = useState<number>(0)
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      const regex = /^(\d{2})-(\d{2})-(\d{4})$/
      const match = dateParam.match(regex)
      const [, dd, mm, yyyy] = match ?? []
      const day = parseInt(dd, 10)
      const month = parseInt(mm, 10) - 1 // месяцы в JS от 0 до 11
      const year = parseInt(yyyy, 10)

      const date = new Date(year, month, day)
      setCurrentDate(date)
    }
  }, [searchParams])

  const daysInMonth = getters.getDaysInMonth(
    currentDate.getMonth(),
    currentDate.getFullYear(),
  )

  const handlePrevMonth = useCallback(() => {
    setDirection(-1)
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    setCurrentDate(newDate)
    navigate(`/employee/schedule/month?date=${formatDateStr(newDate)}`, {
      replace: true,
    })
  }, [currentDate, navigate])

  const handleNextMonth = useCallback(() => {
    setDirection(1)
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    setCurrentDate(newDate)
    navigate(`/employee/schedule/month?date=${formatDateStr(newDate)}`, {
      replace: true,
    })
  }, [currentDate, navigate])

  function handleAddEventForDate(date: Date) {
    if (document.querySelector('[role="dialog"]')) {
      return
    }

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)
    setOpen({ startDate, endDate })
  }

  function handleAddEvent(selectedDay: number) {
    handleAddEventForDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay),
    )
  }

  function handleShowMoreEvents(dayEvents: Event[], dayNumber: number) {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      dayNumber,
    )
    setDayEventsModal({ date: selectedDate, events: dayEvents })
  }

  function handleEditEventFromModal(event: Event) {
    setSelectedEventId(event.id)
    setDayEventsModal(null)
  }

  function handleAddEventFromModal(date: Date) {
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    setOpen({ startDate, endDate })
    setDayEventsModal(null) // Close the day events modal
  }

  const itemVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  }

  const daysOfWeek =
    weekStartsOn === 'monday'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)

  const startOffset =
    (firstDayOfMonth.getDay() - (weekStartsOn === 'monday' ? 1 : 0) + 7) % 7

  // Calculate previous month's last days for placeholders
  const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
  const lastDateOfPrevMonth = new Date(
    prevMonth.getFullYear(),
    prevMonth.getMonth() + 1,
    0,
  ).getDate()

  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
  const totalCells = startOffset + daysInMonth.length
  const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)

  function renderAdjacentDayCell(date: Date, dayLabel: number, key: string) {
    return (
      <div
        key={key}
        className='min-h-24 sm:min-h-28 md:min-h-32 border-r border-b border-border last:border-r-0 bg-muted/10 group cursor-pointer hover:bg-muted/20 transition-colors touch-target relative'
        onClick={e => {
          const target = e.target
          if (target instanceof HTMLElement && target.closest('[data-event-element]')) {
            return
          }
          handleAddEventForDate(date)
        }}
      >
        <div className='p-1 h-full flex flex-col relative'>
          <div className='text-xs text-muted-foreground pl-1 pt-0.5'>{dayLabel}</div>
          <div className='absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded'>
            <span className='text-xs sm:text-sm font-medium text-primary'>
              <span className='hidden sm:inline'>Add Event</span>
              <span className='sm:hidden'>+</span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='w-full'>
      {/* Mobile-optimized header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2'>
        <motion.h2
          key={currentDate.getMonth()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className='text-2xl sm:text-3xl tracking-tighter font-bold text-center sm:text-left'
        >
          {currentDate.toLocaleString('default', { month: 'long' })}{' '}
          {currentDate.getFullYear()}
        </motion.h2>

        {/* Mobile-optimized navigation */}
        <div className='flex gap-2 justify-center sm:justify-end'>
          <Button
            variant='outline'
            size='sm'
            onClick={handlePrevMonth}
            className={'min-w-[80px] touch-target'}
          >
            <ArrowLeft className='w-4 h-4 mr-1' />
            <span className='hidden sm:inline'>Prev</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleNextMonth}
            className={'min-w-[80px] touch-target'}
          >
            <span className='hidden sm:inline'>Next</span>
            <ArrowRight className='w-4 h-4 ml-1' />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction} mode='wait'>
        <motion.div
          key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
          custom={direction}
          variants={pageTransitionVariants}
          initial='enter'
          animate='center'
          exit='exit'
          className='w-full'
        >
          {/* Mobile-responsive calendar grid */}
          <div className='bg-background border border-border rounded-lg overflow-hidden'>
            {/* Days of week header - responsive text */}
            <div className='grid grid-cols-7 bg-muted/30 border-b border-border'>
              {daysOfWeek.map((day, idx) => (
                <div
                  key={idx}
                  className='py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-r border-border last:border-r-0'
                >
                  <span className='hidden sm:inline'>{day}</span>
                  <span className='sm:hidden'>{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Calendar body */}
            <div className='grid grid-cols-7'>
              {/* Previous month's trailing days */}
              {Array.from({ length: startOffset }).map((_, idx) => {
                const day = lastDateOfPrevMonth - startOffset + idx + 1
                const cellDate = new Date(
                  prevMonth.getFullYear(),
                  prevMonth.getMonth(),
                  day,
                )
                return renderAdjacentDayCell(cellDate, day, `offset-${idx}`)
              })}

              {/* Current month's days */}
              {daysInMonth.map((dayObj: { day: number }) => {
                const dayEvents: Event[] = getters.getEventsForDay(
                  dayObj.day,
                  currentDate,
                )
                const isToday =
                  new Date().getDate() === dayObj.day &&
                  new Date().getMonth() === currentDate.getMonth() &&
                  new Date().getFullYear() === currentDate.getFullYear()

                return (
                  <motion.div
                    className='min-h-24 sm:min-h-28 md:min-h-32 border-r border-b border-border last:border-r-0 group cursor-pointer hover:bg-muted/20 transition-colors touch-target relative'
                    key={dayObj.day}
                    variants={itemVariants}
                    initial='enter'
                    animate='center'
                    exit='exit'
                    onClick={e => {
                      const target = e.target
                      if (
                        target instanceof HTMLElement &&
                        target.closest('[data-event-element]')
                      ) {
                        return
                      }
                      handleAddEvent(dayObj.day)
                    }}
                  >
                    <div className='p-1 h-full flex flex-col relative'>
                      <div className='flex justify-start items-start mb-0.5 pl-1 pt-0.5'>
                        <span
                          className={clsx(
                            'text-xs font-normal leading-none',
                            isToday &&
                              'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center',
                            !isToday && 'text-foreground',
                          )}
                        >
                          {dayObj.day}
                        </span>
                      </div>

                      <div className='flex-1 overflow-hidden'>
                        <AnimatePresence mode='wait'>
                          {dayEvents?.length > 0 && (
                            <motion.div
                              key={`day-${dayObj.day}-events`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                              className='flex flex-col gap-0.5 px-0.5'
                            >
                              {dayEvents
                                .slice(0, MAX_VISIBLE_EVENTS)
                                .map((event: Event) => (
                                  <EventStyled
                                    key={event.id}
                                    event={{
                                      ...event,
                                      monthView: true,
                                    }}
                                  />
                                ))}

                              {dayEvents.length > MAX_VISIBLE_EVENTS && (
                                <button
                                  type='button'
                                  className='text-[11px] leading-4 text-left px-1 py-px text-muted-foreground hover:text-foreground truncate w-full'
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleShowMoreEvents(dayEvents, dayObj.day)
                                  }}
                                >
                                  {dayEvents.length - MAX_VISIBLE_EVENTS} more
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Hover text for empty days */}
                      {dayEvents.length === 0 && (
                        <div className='absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded'>
                          <span className='text-xs sm:text-sm font-medium text-primary'>
                            <span className='hidden sm:inline'>Add Event</span>
                            <span className='sm:hidden'>+</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}

              {Array.from({ length: nextMonthPadding }).map((_, idx) => {
                const day = idx + 1
                const cellDate = new Date(
                  nextMonth.getFullYear(),
                  nextMonth.getMonth(),
                  day,
                )
                return renderAdjacentDayCell(cellDate, day, `next-${idx}`)
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Add Event Modal */}
      {open && (
        <AddEventModal
          open={true}
          onOpenChange={isOpen => !isOpen && setOpen(null)}
          defaultValues={{
            startDate: open?.startDate,
            endDate: open?.endDate,
          }}
        />
      )}

      {dayEventsModal && (
        <DayEventsModal
          open={true}
          onOpenChange={isOpen => !isOpen && setDayEventsModal(null)}
          date={dayEventsModal.date}
          events={dayEventsModal.events}
          onEditEvent={handleEditEventFromModal}
          onAddEvent={handleAddEventFromModal}
        />
      )}
    </div>
  )
}
