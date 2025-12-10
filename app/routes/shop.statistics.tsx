import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { data, type LoaderFunctionArgs, useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { Badge } from '~/components/ui/badge'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getShopWorkerUser } from '~/utils/session.server'

type DayMaterial = {
  stone_type: string
  sqft: number
}

type DayStat = {
  day: string
  total: number
  materials: DayMaterial[]
}

type MaterialTotal = {
  stone_type: string
  sqft: number
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getShopWorkerUser(request)
  if (!user || !user.company_id) {
    return data({ days: [], totalSqft: 0, start: '', end: '' })
  }

  const url = new URL(request.url)
  const today = new Date()
  const defaultEnd = format(today, 'yyyy-MM-dd')
  const defaultStart = format(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  const start = url.searchParams.get('start') || defaultStart
  const end = url.searchParams.get('end') || defaultEnd

  // Only include rooms where all slabs are cut; aggregate per day and material.
  const rows = await selectMany<{
    day: string | Date
    stone_type: string
    sqft: number
  }>(
    db,
    `
    SELECT
      DATE(si.cut_date) as day,
      COALESCE(st.type, 'Unknown') as stone_type,
      SUM(COALESCE(si.square_feet, (si.length * si.width) / 144)) as sqft
    FROM slab_inventory si
    JOIN sales s ON si.sale_id = s.id
    JOIN stones st ON si.stone_id = st.id
    WHERE
      s.company_id = ?
      AND si.deleted_at IS NULL
      AND si.sale_id IS NOT NULL
      AND si.room IS NOT NULL
      AND si.cut_date IS NOT NULL
      AND DATE(si.cut_date) BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1
        FROM slab_inventory si2
        WHERE si2.sale_id = si.sale_id
          AND si2.room = si.room
          AND si2.deleted_at IS NULL
          AND si2.cut_date IS NULL
      )
    GROUP BY DATE(si.cut_date), st.name, si.sale_id, si.room
  `,
    [user.company_id, start, end],
  )

  const dayMap = new Map<string, DayMaterial[]>()
  const materialMap = new Map<string, number>()
  rows.forEach(row => {
    const dayKey = format(typeof row.day === 'string' ? parseISO(row.day) : row.day, 'yyyy-MM-dd')
    const list = dayMap.get(dayKey) || []
    list.push({ stone_type: row.stone_type, sqft: row.sqft || 0 })
    dayMap.set(dayKey, list)
    const prev = materialMap.get(row.stone_type) || 0
    materialMap.set(row.stone_type, prev + (row.sqft || 0))
  })

  const days: DayStat[] = Array.from(dayMap.entries())
    .map(([day, materials]) => ({
      day,
      materials: materials.sort((a, b) => (b.sqft || 0) - (a.sqft || 0)),
      total: materials.reduce((sum, m) => sum + (m.sqft || 0), 0),
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1))

  const totalSqft = days.reduce((sum, d) => sum + d.total, 0)

  const materials: MaterialTotal[] = Array.from(materialMap.entries())
    .map(([stone_type, sqft]) => ({ stone_type, sqft }))
    .sort((a, b) => (b.sqft || 0) - (a.sqft || 0))

  return data({ days, materials, totalSqft, start, end })
}

export default function ShopStatistic() {
  const loaded = (useLoaderData<typeof loader>() ?? {}) as Partial<{
    days: DayStat[]
    materials: MaterialTotal[]
    totalSqft: number
    start: string
    end: string
  }>
  const {
    days = [],
    materials = [],
    totalSqft = 0,
    start = '',
    end = '',
  } = loaded
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [openStart, setOpenStart] = useState(false)
  const [openEnd, setOpenEnd] = useState(false)

  const startValue = searchParams.get('start') || start
  const endValue = searchParams.get('end') || end

  const handleDateChange = (key: 'start' | 'end', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    navigate(`/shop/statistics?${next.toString()}`)
  }

  const renderDatePicker = (label: string, value: string, key: 'start' | 'end') => {
    const parsed = value ? parseISO(value) : undefined
    const isOpen = key === 'start' ? openStart : openEnd
    const setIsOpen = key === 'start' ? setOpenStart : setOpenEnd
    return (
      <div className='flex flex-col gap-1 max-w-[220px] w-full'>
        <label className='text-xs text-muted-foreground'>{label}</label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button className='flex items-center justify-between rounded-md border px-2 py-2 text-xs hover:bg-muted h-9'>
              <span>{parsed ? format(parsed, 'MMM dd, yyyy') : 'Pick a date'}</span>
              <CalendarIcon className='w-4 h-4 text-muted-foreground' />
            </button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start' side='bottom'>
            <Calendar
              fixedWeeks
              mode='single'
              selected={parsed}
              defaultMonth={parsed}
              onSelect={date => {
                if (date) {
                  const dateStr = format(date, 'yyyy-MM-dd')
                  handleDateChange(key, dateStr)
                  setIsOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  const sortedDays = useMemo(() => days || [], [days])
  const rangeLabel = useMemo(() => {
    const startFmt = startValue ? format(parseISO(startValue), 'MMM d, yyyy') : ''
    const endFmt = endValue ? format(parseISO(endValue), 'MMM d, yyyy') : ''
    return startFmt && endFmt ? `${startFmt} — ${endFmt}` : ''
  }, [startValue, endValue])

  return (
    <PageLayout title='Shop Statistic'>
      <div className='mb-6 grid grid-cols-1 lg:grid-cols-3 gap-3 items-start'>
        <div className='flex flex-wrap gap-2'>
          {renderDatePicker('Start date', startValue, 'start')}
          {renderDatePicker('End date', endValue, 'end')}
        </div>

        <div className='flex flex-col gap-1'>
          <div className='rounded-md border bg-white px-3 py-2 text-2xl font-semibold'>
            <div className='text-sm font-semibold mb-1'>Materials cut (sqft)</div>
          {materials.length === 0 ? (
            <div className='text-sm text-muted-foreground'>No data</div>
          ) : (
            materials.map((mat: MaterialTotal) => (
              <div key={mat.stone_type} className='flex items-center justify-between text-sm'>
                <span className='font-medium'>{mat.stone_type}</span>
                <span>{Math.round((mat.sqft || 0) * 100) / 100} sqft</span>
              </div>
            ))
          )}
          {materials.length > 0 && (
            <div className='pt-2 border-t text-sm font-semibold flex items-center justify-between'>
              <span>Total</span>
              <span>{Math.round(totalSqft * 100) / 100} sqft</span>
            </div>
          )}
        </div>
          </div>
        </div>

    

      <div className='space-y-3'>
        <div className='text-sm font-semibold'>Cut days</div>
        {sortedDays.length === 0 ? (
          <div className='rounded-lg border bg-white p-4 text-sm text-muted-foreground shadow-sm'>
            No data for selected dates
          </div>
        ) : (
          <div className='grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
            {sortedDays.map(stat => {
              const dateObj = parseISO(stat.day)
              return (
                <div key={stat.day} className='rounded-lg border bg-white p-2 shadow-sm space-y-2 text-sm'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='space-y-0.5 leading-tight'>
                      <div className='text-sm font-semibold'>{format(dateObj, 'MMM d, yyyy')}</div>
                      <div className='text-[11px] text-muted-foreground'>{format(dateObj, 'EEEE')}</div>
                    </div>
                    <div className='text-base font-semibold'>
                      {Math.round((stat.total || 0) * 100) / 100} sqft
                    </div>
                  </div>
                  <div className='space-y-1 text-xs'>
                    {stat.materials.map(mat => (
                      <div key={mat.stone_type} className='flex items-center justify-between gap-1.5'>
                        <Badge variant='secondary' className='truncate max-w-[70%] text-[11px] h-6 px-2'>
                          {mat.stone_type}
                        </Badge>
                        <span className='whitespace-nowrap text-[11px]'>
                          {Math.round((mat.sqft || 0) * 100) / 100} sqft
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </PageLayout>
  )
}

