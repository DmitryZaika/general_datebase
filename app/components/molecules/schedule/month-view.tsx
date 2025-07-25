import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import DayEventsModal from '@/components/molecules/schedule/day-events-modal'
import EventStyled from '@/components/molecules/schedule/event-styled'
import { Button } from '@/components/ui/button'
import { useScheduler } from '~/providers/scheduler-provider'

// Define Event interface locally since it's not exported from types
interface Event {
  id: number
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: string
  notes?: string
}

const pageTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
  }),
  center: {
    opacity: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: 'easeInOut' },
    },
  }),
}

// Helper function to format date as dd-mm-yyyy
function formatDateStr(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export default function MonthView() {
  const { getters, weekStartsOn } = useScheduler()
  const [open, setOpen] = useState<{ startDate: Date; endDate: Date } | null>(null)
  const [dayEventsModal, setDayEventsModal] = useState<{
    date: Date
    events: Event[]
  } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [direction, setDirection] = useState<number>(0)
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      const regex = /^(\d{2})-(\d{2})-(\d{4})$/
      const match = dateParam.match(regex)
      const [, dd, mm, yyyy] = match
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

  function handleAddEvent(selectedDay: number) {
    // Don't open add modal if there's already a modal open (like edit modal)
    if (document.querySelector('[role="dialog"]')) {
      return
    }

    // Create start date at 12:00 AM on the selected day
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      selectedDay,
      0,
      0,
      0,
    )

    // Create end date at 11:59 PM on the same day
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      selectedDay,
      23,
      59,
      59,
    )
    setOpen({ startDate, endDate })
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
    setEditEvent(event)
    setDayEventsModal(null) // Close the day events modal
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
          variants={{
            ...pageTransitionVariants,
            center: {
              ...pageTransitionVariants.center,
              transition: {
                opacity: { duration: 0.2 },
                staggerChildren: 0.02,
              },
            },
          }}
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
                  className='p-2 sm:p-3 text-center text-xs sm:text-sm font-medium text-muted-foreground border-r border-border last:border-r-0'
                >
                  <span className='hidden sm:inline'>{day}</span>
                  <span className='sm:hidden'>{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Calendar body */}
            <div className='grid grid-cols-7'>
              {/* Previous month's trailing days */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <div
                  key={`offset-${idx}`}
                  className='h-20 sm:h-24 md:h-32 lg:h-36 border-r border-b border-border last:border-r-0 p-1 sm:p-2 bg-muted/10'
                >
                  <div className='text-xs sm:text-sm text-muted-foreground'>
                    {lastDateOfPrevMonth - startOffset + idx + 1}
                  </div>
                </div>
              ))}

              {/* Current month's days */}
              {daysInMonth.map((dayObj: any) => {
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
                    className='h-20 sm:h-24 md:h-32 lg:h-36 border-r border-b border-border last:border-r-0 group cursor-pointer hover:bg-muted/20 transition-colors touch-target relative'
                    key={dayObj.day}
                    variants={itemVariants}
                    initial='enter'
                    animate='center'
                    exit='exit'
                    onClick={e => {
                      // Don't open add modal if clicking on an event element
                      const target = e.target as HTMLElement
                      if (target.closest('[data-event-element]')) {
                        return
                      }
                      handleAddEvent(dayObj.day)
                    }}
                  >
                    <div className='p-1 sm:p-2 h-full flex flex-col relative'>
                      {/* Day number */}
                      <div className='flex justify-between items-start mb-1'>
                        <span
                          className={clsx(
                            'text-xs sm:text-sm font-medium leading-none',
                            isToday &&
                              'bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs',
                            dayEvents.length > 0 &&
                              !isToday &&
                              'text-primary font-semibold',
                            dayEvents.length === 0 && !isToday && 'text-foreground',
                          )}
                        >
                          {dayObj.day}
                        </span>
                      </div>

                      {/* Events - mobile optimized */}
                      <div className='flex-1 overflow-hidden'>
                        <AnimatePresence mode='wait'>
                          {dayEvents?.length > 0 && (
                            <motion.div
                              key={`day-${dayObj.day}-events`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                              className='h-full'
                            >
                              {/* Mobile: Show dots and count with click to open modal */}
                              <div
                                className='sm:hidden cursor-pointer p-1 rounded hover:bg-muted/50 transition-colors border border-transparent hover:border-border'
                                onClick={e => {
                                  e.stopPropagation()
                                  handleShowMoreEvents(dayEvents, dayObj.day)
                                }}
                                title={`View all ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`}
                              >
                                <div className='flex gap-1 flex-wrap mb-1'>
                                  {dayEvents.slice(0, 4).map((event: Event) => (
                                    <div
                                      key={event.id}
                                      className={clsx(
                                        'w-2 h-2 rounded-full',
                                        event.variant === 'primary' && 'bg-blue-500',
                                        event.variant === 'danger' && 'bg-red-500',
                                        event.variant === 'success' && 'bg-green-500',
                                        event.variant === 'warning' && 'bg-yellow-500',
                                        !event.variant && 'bg-gray-500',
                                      )}
                                    />
                                  ))}
                                  {dayEvents.length > 4 && (
                                    <div className='w-2 h-2 rounded-full bg-gray-400 flex items-center justify-center'>
                                      <span className='text-xs text-white'>+</span>
                                    </div>
                                  )}
                                </div>
                                <div className='text-xs text-primary font-medium'>
                                  {dayEvents.length} event
                                  {dayEvents.length > 1 ? 's' : ''} →
                                </div>
                              </div>

                              {/* Desktop: Show first event and +X more button */}
                              <div className='hidden sm:block space-y-1'>
                                {dayEvents.slice(0, 1).map((event: Event) => (
                                  <EventStyled
                                    key={event.id}
                                    event={{
                                      ...event,
                                      minmized: true,
                                    }}
                                  />
                                ))}

                                {dayEvents.length > 1 && (
                                  <div
                                    className='text-xs bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors p-1 rounded border border-primary/20 hover:border-primary/40 font-medium text-center'
                                    onClick={e => {
                                      e.stopPropagation()
                                      handleShowMoreEvents(dayEvents, dayObj.day)
                                    }}
                                    title={`View all ${dayEvents.length} events`}
                                  >
                                    +{dayEvents.length - 1} more →
                                  </div>
                                )}
                              </div>
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

      {/* Edit Event Modal */}
      {editEvent && (
        <AddEventModal
          open={true}
          onOpenChange={isOpen => !isOpen && setEditEvent(null)}
          defaultValues={{
            id: editEvent.id,
            title: editEvent.title,
            description: editEvent.description,
            startDate: editEvent.startDate,
            endDate: editEvent.endDate,
            variant: editEvent.variant,
            notes: editEvent.notes,
          }}
        />
      )}

      {/* Day Events Modal */}
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
