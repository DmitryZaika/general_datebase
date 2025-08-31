import * as React from 'react'

import { cn } from '~/lib/utils'

export type ChartConfig = Record<string, string>

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: Record<string, string>
  }
>(({ className, config, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex w-full items-center justify-center [&>svg]:h-4 [&>svg]:w-4',
      className,
    )}
    {...props}
  />
))
ChartContainer.displayName = 'ChartContainer'

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    content?: React.ComponentType<any>
    cursor?: boolean
  }
>(({ className, content: Content, cursor = true, ...props }, ref) => {
  if (!Content) return null

  return (
    <Content
      ref={ref}
      className={cn('rounded-lg border bg-background p-2 shadow-md', className)}
      cursor={cursor}
      {...props}
    />
  )
})
ChartTooltip.displayName = 'ChartTooltip'

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    label?: string
    labelFormatter?: (value: string) => string
    indicator?: 'line' | 'dot' | 'dashed'
  }
>(({ className, label, labelFormatter, indicator = 'dot', ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'grid min-w-[8rem] gap-1.5 rounded-md border bg-background p-2.5 text-sm shadow-md',
        className,
      )}
      {...props}
    />
  )
})
ChartTooltipContent.displayName = 'ChartTooltipContent'

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    content?: React.ComponentType<any>
  }
>(({ className, content: Content, ...props }, ref) => {
  if (!Content) return null

  return (
    <Content
      className={cn('flex items-center justify-center gap-4 pt-6', className)}
      {...props}
    />
  )
})
ChartLegend.displayName = 'ChartLegend'

const ChartLegendContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}
ChartLegendContent.displayName = 'ChartLegendContent'

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
}
