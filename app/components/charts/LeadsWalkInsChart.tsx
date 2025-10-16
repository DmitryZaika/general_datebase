import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ChartData = {
  date: string
  day_name: string
  leads: number
  walkins: number
}

type LeadsWalkInsChartProps = {
  data: ChartData[]
}

export function LeadsWalkInsChart({ data }: LeadsWalkInsChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
    day_name: item.day_name,
    fullDateWithDay: `${format(new Date(item.date), 'MMM dd')} ${item.day_name}`,
  }))

  return (
    <div className='w-full h-[400px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart
          data={formattedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor='end'
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(value, payload) => {
              if (payload?.[0]) {
                const data = payload[0].payload
                return `${data.date} ${data.day_name}`
              }
              return value
            }}
          />
          <Legend />
          <Area
            type='monotone'
            dataKey='leads'
            stackId='1'
            stroke='#8884d8'
            fill='#8884d8'
            fillOpacity={0.6}
            name='Leads'
          />
          <Area
            type='monotone'
            dataKey='walkins'
            stackId='1'
            stroke='#82ca9d'
            fill='#82ca9d'
            fillOpacity={0.6}
            name='Walk-ins'
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
