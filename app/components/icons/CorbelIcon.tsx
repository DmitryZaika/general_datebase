import type { LucideProps } from 'lucide-react'
import { forwardRef } from 'react'

export const CorbelIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => {
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
      {/* Horizontal part (was vertical) */}
      <path d='M19,6 L5,6' />

      {/* Vertical part (was horizontal) */}
      <path d='M5,6 L5,18' />

      {/* Support diagonal */}
      <path d='M5,13 L12,6' />
    </svg>
  )
})

CorbelIcon.displayName = 'CorbelIcon'

export default CorbelIcon
