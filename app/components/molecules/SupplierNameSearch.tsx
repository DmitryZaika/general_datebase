import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '~/components/ui/input'

interface SupplierListItem {
  id: number
  supplier_name: string
}

interface SupplierNameSearchProps {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
}

async function fetchSuppliers(search: string): Promise<SupplierListItem[]> {
  const params = new URLSearchParams()
  if (search.trim()) {
    params.set('q', search.trim())
  }
  const response = await fetch(`/api/suppliers/list?${params.toString()}`)
  if (!response.ok) return []
  const data: { suppliers?: SupplierListItem[] } = await response.json()
  return data.suppliers ?? []
}

export function SupplierNameSearch({
  value,
  onChange,
  disabled,
}: SupplierNameSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  const { data: suppliers = [], isFetching } = useQuery({
    queryKey: ['chatSuppliers', inputValue, isOpen],
    queryFn: () => fetchSuppliers(inputValue),
    enabled: isOpen,
    staleTime: 60_000,
  })

  const filteredSuppliers = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return suppliers
    return suppliers.filter(item => item.supplier_name.toLowerCase().includes(query))
  }, [inputValue, suppliers])

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name)
      setInputValue(name)
      setIsOpen(false)
    },
    [onChange],
  )

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value
      setInputValue(next)
      onChange(next)
      setIsOpen(true)
    },
    [onChange],
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

  const toggleDropdown = useCallback(() => {
    if (disabled) return
    setIsOpen(open => !open)
  }, [disabled])

  return (
    <div className='relative'>
      <div className='flex items-center rounded-md border border-zinc-200 bg-white shadow-xs focus-within:ring-1 focus-within:ring-zinc-950'>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder='Supplier name'
          className='border-0 shadow-none focus-visible:ring-0 rounded-r-none'
        />
        <button
          type='button'
          aria-label='Show suppliers'
          disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={toggleDropdown}
          className='flex h-9 w-9 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50'
        >
          <ChevronDown className='size-4' />
        </button>
      </div>
      {isOpen && filteredSuppliers.length > 0 ? (
        <div
          className='absolute bottom-full z-30 mb-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md'
          onMouseDown={event => event.preventDefault()}
        >
          <ul className='py-1'>
            {filteredSuppliers.map(supplier => (
              <li key={supplier.id}>
                <button
                  type='button'
                  className='w-full px-3 py-2 text-left text-sm hover:bg-zinc-50'
                  onMouseDown={() => handleSelect(supplier.supplier_name)}
                >
                  {supplier.supplier_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {isOpen && isFetching && filteredSuppliers.length === 0 ? (
        <div className='absolute bottom-full z-30 mb-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-md'>
          Loading suppliers…
        </div>
      ) : null}
    </div>
  )
}
