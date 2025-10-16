import { useQuery } from '@tanstack/react-query'
import { LeadsWalkInsChart } from './LeadsWalkInsChart'

type ChartData = {
  date: string
  day_name: string
  leads: number
  walkins: number
}

type LeadsWalkInsChartContainerProps = {
  fromDate?: string
  toDate?: string
}

export function LeadsWalkInsChartContainer({
  fromDate,
  toDate,
}: LeadsWalkInsChartContainerProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leads-walkins-chart', fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const response = await fetch(`/api/leads-walkins-chart?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch chart data')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className='w-full h-[400px] flex items-center justify-center'>
        <div className='text-muted-foreground'>Loading chart data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='w-full h-[400px] flex items-center justify-center'>
        <div className='text-destructive'>
          Error loading chart data: {error.message}
        </div>
      </div>
    )
  }

  const chartData = data?.chartData || []

  if (chartData.length === 0) {
    return (
      <div className='w-full h-[400px] flex items-center justify-center'>
        <div className='text-muted-foreground'>
          No data available for the selected period
        </div>
      </div>
    )
  }

  return <LeadsWalkInsChart data={chartData} />
}
