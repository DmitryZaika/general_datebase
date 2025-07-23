import EventStyled from '@/components/molecules/schedule/event-styled'
import type { Event } from '@/types'
import React, { useEffect, useState } from 'react'
import { CalendarIcon } from 'lucide-react'

export default function ShowMoreEventsModal() {
  const dayEvents = []

  const [events, setEvents] = useState<Event[]>(dayEvents)

  useEffect(() => {
    setEvents(dayEvents)
  }, [dayEvents])

  return (
    <div className='flex flex-col gap-2'>
      {events.length > 0 ? (
        events.map((event: Event) => (
          <EventStyled
            onDelete={id => {
              setEvents(events.filter(event => event.id !== id))
            }}
            key={event.id}
            event={{
              ...event,
            }}
          />
        ))
      ) : (
        <div className='flex flex-col items-center justify-center py-6 text-center'>
          <CalendarIcon className='h-12 w-12 text-primary mb-2' />
          <p className='text-lg font-medium text-primary'>No events found</p>
          <p className='text-sm text-muted-foreground'>
            There are no events scheduled for this day.
          </p>
        </div>
      )}
    </div>
  )
}
