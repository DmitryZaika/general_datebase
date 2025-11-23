import { useEffect, useRef, useState, type MouseEvent } from 'react'

interface CopyTextProps {
  value?: string
  display?: string
  title?: string
  className?: string
}

export function CopyText({ value, display, title, className }: CopyTextProps) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current)
    }
  }, [])

  if (!value) return <span />

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(value)
    }
    setCopied(true)
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => {
      setCopied(false)
      resetRef.current = null
    }, 1500)
  }

  const showLabel = hovered || copied
  const labelText = copied ? 'Copied' : 'Copy'

  return (
    <button
      type='button'
      title={title ?? value}
      className={`group relative inline-flex items-center bg-transparent p-0 text-left text-current border-0 focus-visible:outline-none`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className='relative inline-flex items-center justify-center'>
        <span
          className={`${className ?? ''} transition-opacity duration-200 ${showLabel ? 'opacity-10' : 'opacity-100'}`}
        >
          {display ?? value}
        </span>
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-md transition-opacity duration-200 ${
            showLabel ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {labelText}
        </span>
      </span>
    </button>
  )
}


