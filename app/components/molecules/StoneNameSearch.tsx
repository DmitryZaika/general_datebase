import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Input } from '~/components/ui/input'

export interface DesignStone {
  id: number
  name: string
  url: string | null
  type: string | null
}

const MAX_AI_DESIGN_STONES = 3

interface StoneNameSearchProps {
  selected: DesignStone[]
  onAdd: (stone: DesignStone) => void
  onRemove: (id: number) => void
  disabled?: boolean
  maxStones?: number
}

async function fetchStoneNames(): Promise<DesignStone[]> {
  const response = await fetch('/api/ai-design')
  if (!response.ok) {
    throw new Error('Failed to load stones')
  }
  const data: { stones?: DesignStone[] } = await response.json()
  return (data.stones ?? []).map(stone => ({
    id: stone.id,
    name: stone.name,
    type: stone.type,
    url: null,
  }))
}

function StoneDropdownPortal({
  anchorRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>
  open: boolean
  children: React.ReactNode
}) {
  const [position, setPosition] = useState<{
    left: number
    width: number
    bottom: number
    maxHeight: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null)
      return
    }

    const update = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 4,
        maxHeight: Math.max(120, Math.min(224, rect.top - 8)),
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef, open])

  if (!open || !position) return null

  return createPortal(
    <div
      className='fixed z-[9999] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md'
      style={{
        left: position.left,
        width: position.width,
        bottom: position.bottom,
        maxHeight: position.maxHeight,
      }}
      onMouseDown={event => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}

export function StoneNameSearch({
  selected,
  onAdd,
  onRemove,
  disabled,
  maxStones = MAX_AI_DESIGN_STONES,
}: StoneNameSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  const {
    data: stones = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['aiDesignStoneNames'],
    queryFn: fetchStoneNames,
    enabled: isOpen,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })

  const selectedIds = useMemo(
    () => new Set(selected.map(stone => stone.id)),
    [selected],
  )

  const visibleStones = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    const available = stones.filter(item => !selectedIds.has(item.id))
    if (!query) return available.slice(0, 40)
    return available
      .filter(item => item.name.toLowerCase().includes(query))
      .slice(0, 40)
  }, [inputValue, stones, selectedIds])

  const handleSelect = useCallback(
    (stone: DesignStone) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      onAdd(stone)
      setInputValue('')
      setIsOpen(false)
    },
    [onAdd],
  )

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setIsOpen(true)
  }, [])

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 150)
  }, [])

  const atStoneLimit = selected.length >= maxStones
  const searchDisabled = disabled || atStoneLimit

  const toggleDropdown = useCallback(() => {
    if (searchDisabled) return
    setIsOpen(open => !open)
  }, [searchDisabled])

  const showResults = isOpen && !searchDisabled
  const showLoading = showResults && isFetching && stones.length === 0
  const showEmpty = showResults && !isFetching && !isError && visibleStones.length === 0

  return (
    <div className='flex flex-col gap-2'>
      {selected.length > 0 ? (
        <ul className='flex flex-wrap gap-2'>
          {selected.map(stone => (
            <li
              key={stone.id}
              className='flex items-center gap-1 rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-2 text-sm'
            >
              <span className='max-w-[12rem] truncate'>{stone.name}</span>
              <button
                type='button'
                aria-label={`Remove ${stone.name}`}
                className='rounded-full p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                onClick={() => onRemove(stone.id)}
                disabled={disabled}
              >
                <X className='size-3.5' />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={anchorRef} className='relative'>
        <div className='flex items-center rounded-md border border-zinc-200 bg-white shadow-xs focus-within:ring-1 focus-within:ring-zinc-950'>
          <Input
            value={inputValue}
            onChange={event => {
              setInputValue(event.target.value)
              setIsOpen(true)
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={searchDisabled}
            placeholder={atStoneLimit ? 'Maximum stones selected' : 'Search stone name'}
            className='border-0 shadow-none focus-visible:ring-0 rounded-r-none'
          />
          <button
            type='button'
            aria-label='Show stones'
            disabled={searchDisabled}
            onMouseDown={event => event.preventDefault()}
            onClick={toggleDropdown}
            className='flex h-9 w-9 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50'
          >
            <ChevronDown className='size-4' />
          </button>
        </div>
        <StoneDropdownPortal
          anchorRef={anchorRef}
          open={showResults && visibleStones.length > 0}
        >
          <ul className='py-1'>
            {visibleStones.map(stone => (
              <li key={stone.id}>
                <button
                  type='button'
                  className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50'
                  onMouseDown={() => handleSelect(stone)}
                >
                  <span className='flex-1 truncate'>{stone.name}</span>
                  {stone.type ? (
                    <span className='text-xs text-zinc-400'>{stone.type}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </StoneDropdownPortal>
        <StoneDropdownPortal anchorRef={anchorRef} open={showLoading}>
          <div className='px-3 py-2 text-sm text-zinc-500'>Loading stones…</div>
        </StoneDropdownPortal>
        <StoneDropdownPortal anchorRef={anchorRef} open={showEmpty}>
          <div className='px-3 py-2 text-sm text-zinc-500'>No stones found</div>
        </StoneDropdownPortal>
        <StoneDropdownPortal anchorRef={anchorRef} open={showResults && isError}>
          <div className='px-3 py-2 text-sm text-red-600'>Could not load stones</div>
        </StoneDropdownPortal>
      </div>
    </div>
  )
}
