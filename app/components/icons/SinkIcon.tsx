import type { LucideProps } from 'lucide-react'
import { forwardRef } from 'react'

export const SinkIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => {
  const {
    color = 'currentColor',
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    ...restProps
  } = props

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      fill='none'
      stroke={color}
      strokeWidth={
        absoluteStrokeWidth
          ? Number(strokeWidth)
          : (Number(strokeWidth) * 24) / Number(size)
      }
      strokeLinecap='round'
      strokeLinejoin='round'
      {...restProps}
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
    >
      {/* Sink countertop/outer frame */}
      <rect x='3' y='6' width='18' height='14' rx='1' />

      {/* Left bowl */}
      <rect x='5' y='9' width='6' height='9' rx='1' />

      {/* Right bowl */}
      <rect x='13' y='9' width='6' height='9' rx='1' />
    </svg>
  )
})

SinkIcon.displayName = 'SinkIcon'

export default SinkIcon
