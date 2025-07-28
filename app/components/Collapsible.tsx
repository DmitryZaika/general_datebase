import type React from 'react'

interface CollapsibleProps {
  isOpen: boolean
  openDuration?: string
  closeDuration?: string
  maxHeight?: string
  children: React.ReactNode
  className?: string
}

export function Collapsible({
  isOpen,
  openDuration = 'duration-300',
  closeDuration = 'duration-300',
  maxHeight = 'max-h-[5000px]',
  children,
  className = ' sm:pl-4',
}: CollapsibleProps) {
  return (
    <div
      className={`overflow-hidden transition-[max-height] ease-in-out ${
        isOpen ? `${openDuration} ${maxHeight}` : `${closeDuration} max-h-0`
      } ${className}`}
    >
      {children}
    </div>
  )
}
