import type React from 'react'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useScheduler } from '~/providers/scheduler-provider'
import { Badge } from '@/components/ui/badge'
import { AnimatePresence, motion } from 'framer-motion' // Import Framer Motion
import AddEventModal from '@/components/molecules/schedule/add-event-modal'
import EventStyled from '@/components/molecules/schedule/event-styled'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Maximize } from 'lucide-react'
import clsx from 'clsx'
import { CustomEventModal } from '@/types'
import { useNavigate } from 'react-router'

// Define Event interface locally since it's not exported from types
interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date
  description?: string
  variant?: string
  notes?: string
}

const hours = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12
  const ampm = i < 12 ? 'AM' : 'PM'
  return `${hour}:00 ${ampm}`
})

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger children animations
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.12 } },
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

export default function WeeklyView() {
  const { getters, handlers } = useScheduler()
  const hoursColumnRef = useRef<HTMLDivElement>(null)
  const [detailedHour, setDetailedHour] = useState<string | null>(null)
  const [timelinePosition, setTimelinePosition] = useState<number>(0)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [colWidth, setColWidth] = useState<number[]>(Array(7).fill(1)) // Equal width columns by default
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [direction, setDirection] = useState<number>(0)
  const [open, setOpen] = useState<{ startDate: Date; endDate: Date } | null>(null)
  const navigate = useNavigate()

  const daysOfWeek = getters?.getDaysInWeek(
    getters?.getWeekNumber(currentDate),
    currentDate.getFullYear(),
  )

  // Reset column widths when the date changes
  useEffect(() => {
    setColWidth(Array(7).fill(1))
  }, [currentDate])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hourHeight = rect.height / 24
    const hourFloat = y / hourHeight
    const hour = Math.floor(hourFloat)
    const minutes = Math.floor((hourFloat - hour) * 60)

    // Format the time
    const displayHour = hour % 12 || 12
    const ampm = hour < 12 ? 'AM' : 'PM'
    const formattedMinutes = minutes.toString().padStart(2, '0')

    setDetailedHour(`${displayHour}:${formattedMinutes} ${ampm}`)
    setTimelinePosition(y)
  }, [])

  function handleAddEvent(event?: Partial<Event>) {
    const startDate = event?.startDate || new Date()
    const endDate = event?.endDate || new Date(startDate.getTime() + 60 * 60 * 1000)
    setOpen({ startDate, endDate })
  }

  const handleNextWeek = useCallback(() => {
    setDirection(1)
    const nextWeek = new Date(currentDate)
    nextWeek.setDate(currentDate.getDate() + 7)
    setCurrentDate(nextWeek)
    navigate(`/employee/schedule/week?date=${formatDateStr(nextWeek)}`, {
      replace: true,
    })
  }, [currentDate, navigate])

  const handlePrevWeek = useCallback(() => {
    setDirection(-1)
    const prevWeek = new Date(currentDate)
    prevWeek.setDate(currentDate.getDate() - 7)
    setCurrentDate(prevWeek)
    navigate(`/employee/schedule/week?date=${formatDateStr(prevWeek)}`, {
      replace: true,
    })
  }, [currentDate, navigate])

  function handleAddEventWeek(dayIndex: number, detailedHour: string) {
    if (!detailedHour) return

    const [timePart, ampm] = detailedHour.split(' ')
    const [hourStr, minuteStr] = timePart.split(':')
    let hours = parseInt(hourStr)
    const minutes = parseInt(minuteStr)

    if (ampm === 'PM' && hours < 12) {
      hours += 12
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0
    }

    const chosenDay = daysOfWeek[dayIndex % 7]
    if (!chosenDay) return

    const date = new Date(
      chosenDay.getFullYear(),
      chosenDay.getMonth(),
      chosenDay.getDate(),
      hours,
      minutes,
    )

    handleAddEvent({
      startDate: date,
      endDate: new Date(date.getTime() + 60 * 60 * 1000),
      title: '',
      id: '',
      variant: 'primary',
    })
  }

  // Group events by time period to prevent splitting spaces within same time blocks
  const groupEventsByTimePeriod = (events: Event[] | undefined) => {
    if (!events || events.length === 0) return []

    // Sort events by start time
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )

    // Precise time overlap checking function
    const eventsOverlap = (event1: Event, event2: Event) => {
      const start1 = new Date(event1.startDate).getTime()
      const end1 = new Date(event1.endDate).getTime()
      const start2 = new Date(event2.startDate).getTime()
      const end2 = new Date(event2.endDate).getTime()

      // Strict time overlap - one event starts before the other ends
      return start1 < end2 && start2 < end1
    }

    // First, create a graph where events are vertices and edges represent overlaps
    const graph: Record<string, Set<string>> = {}

    // Initialize graph
    for (const event of sortedEvents) {
      graph[event.id] = new Set<string>()
    }

    // Build connections - only connect events that truly overlap in time
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        // Only consider events that actually overlap in time
        if (eventsOverlap(sortedEvents[i], sortedEvents[j])) {
          graph[sortedEvents[i].id].add(sortedEvents[j].id)
          graph[sortedEvents[j].id].add(sortedEvents[i].id)
        }
      }
    }

    // Use DFS to find connected components (groups of overlapping events)
    const visited = new Set<string>()
    const groups: Event[][] = []

    for (const event of sortedEvents) {
      if (!visited.has(event.id)) {
        // Start a new component/group
        const group: Event[] = []
        const stack: Event[] = [event]
        visited.add(event.id)

        // DFS traversal
        while (stack.length > 0) {
          const current = stack.pop()!
          group.push(current)

          // Visit neighbors (overlapping events)
          for (const neighborId of graph[current.id]) {
            if (!visited.has(neighborId)) {
              const neighbor = sortedEvents.find(e => e.id === neighborId)
              if (neighbor) {
                stack.push(neighbor)
                visited.add(neighborId)
              }
            }
          }
        }

        // Sort this group by start time
        group.sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        )

        groups.push(group)
      }
    }

    return groups
  }

  const getWeekRange = () => {
    if (daysOfWeek.length === 0) return ''
    const start = daysOfWeek[0]
    const end = daysOfWeek[6]
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  return (
    <div className='w-full px-2 sm:px-4'>
      {/* Mobile-responsive header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2'>
        <h1 className='text-xl sm:text-2xl lg:text-3xl font-semibold text-center sm:text-left leading-tight'>
          {getWeekRange()}
        </h1>

        <div className='flex gap-2 justify-center sm:justify-end'>
          <Button
            variant='outline'
            size='sm'
            onClick={handlePrevWeek}
            className={'min-w-[80px] touch-target'}
          >
            <ArrowLeft className='w-4 h-4 mr-1' />
            <span className='hidden sm:inline'>Prev</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleNextWeek}
            className={'min-w-[80px] touch-target'}
          >
            <span className='hidden sm:inline'>Next</span>
            <ArrowRight className='w-4 h-4 ml-1' />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction} mode='wait'>
        <motion.div
          key={`${daysOfWeek[0]?.toISOString()}-week`}
          custom={direction}
          variants={pageTransitionVariants}
          initial='enter'
          animate='center'
          exit='exit'
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className='space-y-4'
        >
          {/* Mobile-responsive week view */}
          <div className='bg-background border border-border rounded-lg overflow-hidden'>
            {/* Days header - Mobile responsive */}
            <div className='flex bg-muted/30 border-b border-border'>
              {/* Hours column placeholder */}
              <div className='w-12 sm:w-16 border-r border-border bg-muted/40 flex-shrink-0'></div>

              {/* Days of week */}
              <div className='flex flex-1 min-w-0'>
                {daysOfWeek.map((day: Date, index: number) => {
                  const isToday =
                    day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear()

                  const dayEvents: Event[] =
                    getters.getEventsForDay(day.getDate(), day) || []

                  return (
                    <div
                      key={index}
                      className='flex-1 min-w-0 border-r border-border last:border-r-0 p-2 sm:p-3'
                    >
                      <div className='text-center'>
                        <div className='text-xs sm:text-sm font-medium text-muted-foreground'>
                          <span className='hidden sm:inline'>
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                          <span className='sm:hidden'>
                            {day
                              .toLocaleDateString('en-US', { weekday: 'short' })
                              .slice(0, 1)}
                          </span>
                        </div>
                        <div
                          className={clsx(
                            'text-sm sm:text-lg font-semibold mt-1',
                            isToday &&
                              'bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center mx-auto',
                            dayEvents.length > 0 && !isToday && 'text-primary',
                            !isToday && dayEvents.length === 0 && 'text-foreground',
                          )}
                        >
                          {day.getDate()}
                        </div>

                        {/* Mobile: Show event count */}
                        {dayEvents.length > 0 && (
                          <div className='text-xs text-muted-foreground mt-1 sm:hidden'>
                            {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Week schedule grid - Mobile optimized */}
            <div className='overflow-x-auto'>
              <motion.div
                className='relative flex min-w-[600px]' // Minimum width for mobile scrolling
                ref={hoursColumnRef}
                variants={containerVariants}
                initial='hidden'
                animate='visible'
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setDetailedHour(null)}
              >
                {/* Hours Column */}
                <div className='w-12 sm:w-16 border-r border-border bg-muted/20 flex-shrink-0'>
                  {hours.map((hour, index) => (
                    <motion.div
                      key={`hour-${index}`}
                      variants={itemVariants}
                      className='h-12 sm:h-16 border-b border-border/50 flex items-start justify-center pt-1 text-xs text-muted-foreground'
                    >
                      <span className='hidden sm:inline'>{hour}</span>
                      <span className='sm:hidden text-xs'>
                        {hour.split(':')[0]}
                        {hour.includes('AM') ? 'A' : 'P'}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Days columns */}
                <div className='flex flex-1'>
                  {daysOfWeek.map((day: Date, dayIndex: number) => {
                    const dayEvents: Event[] =
                      getters.getEventsForDay(day.getDate(), day) || []

                    return (
                      <div
                        key={dayIndex}
                        className='flex-1 border-r border-border last:border-r-0 relative'
                      >
                        {/* Hour grid lines */}
                        {Array.from({ length: 24 }).map((_, hourIndex) => (
                          <div
                            key={`hour-${hourIndex}`}
                            onClick={() =>
                              handleAddEventWeek(dayIndex, detailedHour as string)
                            }
                            className='w-full h-12 sm:h-16 border-b border-border/30 hover:bg-muted/20 transition-colors duration-300 cursor-pointer group relative'
                          >
                            {/* Add Event Overlay - Touch friendly */}
                            <div className='absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                              <span className='text-primary text-xs font-medium'>
                                <span className='hidden sm:inline'>Add</span>
                                <span className='sm:hidden'>+</span>
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Events for this day */}
                        <div className='absolute inset-0 pointer-events-none'>
                          {dayEvents.map((event: Event, eventIndex) => {
                            const { height, left, maxWidth, minWidth, top, zIndex } =
                              handlers.handleEventStyling
                                ? handlers.handleEventStyling(event, dayEvents, {
                                    eventsInSamePeriod: 1,
                                    periodIndex: 0,
                                    adjustForPeriod: true,
                                  })
                                : {
                                    height: '48px',
                                    left: '0px',
                                    maxWidth: '100%',
                                    minWidth: '100%',
                                    top: '0px',
                                    zIndex: 1,
                                  }

                            return (
                              <motion.div
                                key={event.id}
                                style={{
                                  minHeight: height,
                                  top: top,
                                  left: left,
                                  maxWidth: maxWidth,
                                  minWidth: minWidth,
                                  padding: '0 2px',
                                  boxSizing: 'border-box',
                                }}
                                className='absolute pointer-events-auto'
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                              >
                                <EventStyled
                                  event={{
                                    ...event,
                                    minmized: true,
                                  }}
                                />
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Timeline indicator - Mobile optimized */}
                {detailedHour && (
                  <div
                    className='absolute left-0 w-full h-0.5 bg-primary/60 pointer-events-none z-50'
                    style={{ top: `${timelinePosition}px` }}
                  >
                    <Badge
                      variant='outline'
                      className='absolute -translate-y-1/2 bg-background border-primary/60 left-2 text-xs px-2 py-0.5'
                    >
                      {detailedHour}
                    </Badge>
                  </div>
                )}
              </motion.div>
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
    </div>
  )
}
