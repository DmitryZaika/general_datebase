import { useState, useEffect } from 'react'

interface ModuleListProps {
  children: React.ReactNode
  className?: string
}

export default function ModuleList({ children, className }: ModuleListProps) {
  const [mounted, setMounted] = useState(false)

  // Базовая анимация при монтировании
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`
      grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7
      gap-2 px-2 select-none
      ${className || ''}
    `}
    >
      <style>{`
        .module-item {
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(15px)'};
          transition: opacity 0.1s ease-out, transform 0.2s ease-out;
        }
        
        .module-item:nth-child(1) { transition-delay: 0.02s; }
        .module-item:nth-child(2) { transition-delay: 0.04s; }
        .module-item:nth-child(3) { transition-delay: 0.06s; }
        .module-item:nth-child(4) { transition-delay: 0.08s; }
        .module-item:nth-child(5) { transition-delay: 0.10s; }
        .module-item:nth-child(6) { transition-delay: 0.12s; }
        .module-item:nth-child(7) { transition-delay: 0.14s; }
        .module-item:nth-child(8) { transition-delay: 0.16s; }
        .module-item:nth-child(9) { transition-delay: 0.18s; }
        .module-item:nth-child(10) { transition-delay: 0.20s; }
        .module-item:nth-child(11) { transition-delay: 0.22s; }
        .module-item:nth-child(12) { transition-delay: 0.24s; }
        .module-item:nth-child(13) { transition-delay: 0.26s; }
        .module-item:nth-child(14) { transition-delay: 0.28s; }
        .module-item:nth-child(15) { transition-delay: 0.30s; }
        .module-item:nth-child(16) { transition-delay: 0.32s; }
        .module-item:nth-child(17) { transition-delay: 0.34s; }
        .module-item:nth-child(18) { transition-delay: 0.36s; }
        .module-item:nth-child(19) { transition-delay: 0.38s; }
        .module-item:nth-child(20) { transition-delay: 0.40s; }
        .module-item:nth-child(n+21) { transition-delay: 0.42s; }
      `}</style>
      {children}
    </div>
  )
}
