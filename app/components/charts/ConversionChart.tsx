import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/components/ui/chart'

type ConversionChartProps = {
  data: {
    metric: string
    percentage: number
    fill: string
  }[]
}

const chartConfig = {
  percentage: {
    label: 'Percentage',
  },
  total: {
    label: 'Total Sold',
    color: 'hsl(var(--chart-1))',
  },
  leads: {
    label: 'Closed Leads',
    color: 'hsl(var(--chart-2))',
  },
  walkin: {
    label: 'Walk-in',
    color: 'hsl(var(--chart-3))',
  },
  callin: {
    label: 'Call-in',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig

export function ConversionChart({ data }: ConversionChartProps) {
  return (
    <ChartContainer config={chartConfig} className='min-h-[300px] w-full'>
      <BarChart accessibilityLayer data={data} margin={{ top: 20 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey='metric'
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={value => {
            // Shorten labels for axis
            if (value.includes('Total')) return 'Total'
            if (value.includes('Leads')) return 'Leads'
            if (value.includes('Walk-in')) return 'Walk-in'
            if (value.includes('Call-in')) return 'Call-in'
            return value
          }}
        />
        <YAxis hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey='percentage' radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
          <LabelList
            dataKey='percentage'
            position='top'
            offset={12}
            className='fill-foreground'
            fontSize={12}
            formatter={(value: number) => `${value}%`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

