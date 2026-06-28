import { useLayoutEffect, useState } from 'react'
import { cn } from '~/lib/utils'

interface ModuleListProps {
  children: React.ReactNode
  className?: string
  skipItemMountAnimation?: boolean
  subtleSlideDown?: boolean
}

export default function ModuleList({
  children,
  className,
  skipItemMountAnimation = false,
  subtleSlideDown = false,
}: ModuleListProps) {
  const [mounted, setMounted] = useState(skipItemMountAnimation)

  useLayoutEffect(() => {
    if (skipItemMountAnimation) {
      setMounted(true)
      return
    }

    const timer = setTimeout(() => {
      setMounted(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [skipItemMountAnimation])

  const animateWaterfall = !skipItemMountAnimation
  const itemTransition = animateWaterfall
    ? subtleSlideDown
      ? 'opacity 0.2s ease-out, transform 0.2s ease-out'
      : 'opacity 0.2s ease-out'
    : 'none'

  return (
    <div
      className={cn(
        'module-list-grid grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-2 px-2 select-none',
        className,
      )}
    >
      <style>{`
        .module-list-grid > .module-item {
          opacity: ${mounted ? 1 : 0};
          transform: ${subtleSlideDown ? (mounted ? 'translateY(0)' : 'translateY(-6px)') : 'none'};
          transition: ${itemTransition};
        }

        .module-list-grid > .module-item:nth-child(1) { transition-delay: 0.02s; }
        .module-list-grid > .module-item:nth-child(2) { transition-delay: 0.04s; }
        .module-list-grid > .module-item:nth-child(3) { transition-delay: 0.06s; }
        .module-list-grid > .module-item:nth-child(4) { transition-delay: 0.08s; }
        .module-list-grid > .module-item:nth-child(5) { transition-delay: 0.10s; }
        .module-list-grid > .module-item:nth-child(6) { transition-delay: 0.12s; }
        .module-list-grid > .module-item:nth-child(7) { transition-delay: 0.14s; }
        .module-list-grid > .module-item:nth-child(8) { transition-delay: 0.16s; }
        .module-list-grid > .module-item:nth-child(9) { transition-delay: 0.18s; }
        .module-list-grid > .module-item:nth-child(10) { transition-delay: 0.20s; }
        .module-list-grid > .module-item:nth-child(11) { transition-delay: 0.22s; }
        .module-list-grid > .module-item:nth-child(12) { transition-delay: 0.24s; }
        .module-list-grid > .module-item:nth-child(13) { transition-delay: 0.26s; }
        .module-list-grid > .module-item:nth-child(14) { transition-delay: 0.28s; }
        .module-list-grid > .module-item:nth-child(15) { transition-delay: 0.30s; }
        .module-list-grid > .module-item:nth-child(16) { transition-delay: 0.32s; }
        .module-list-grid > .module-item:nth-child(17) { transition-delay: 0.34s; }
        .module-list-grid > .module-item:nth-child(18) { transition-delay: 0.36s; }
        .module-list-grid > .module-item:nth-child(19) { transition-delay: 0.38s; }
        .module-list-grid > .module-item:nth-child(20) { transition-delay: 0.40s; }
        .module-list-grid > .module-item:nth-child(n+21) { transition-delay: 0.42s; }
      `}</style>
      {children}
    </div>
  )
}
