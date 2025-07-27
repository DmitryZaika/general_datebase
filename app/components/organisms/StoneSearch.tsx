import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import type { StoneSearchResult, StoneSlim } from '~/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const fetchAvailableStones = async (query: string = '') => {
  const response = await fetch(
    `/api/stones/search?name=${encodeURIComponent(query)}&unsold_only=true`,
  )
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data = await response.json()
  const stones: StoneSearchResult[] = data.stones || []

  const typeMap: Record<string, string> = {}
  stones.forEach(stone => {
    typeMap[stone.name] = stone.type
  })

  return { stoneType: typeMap, stoneSearchResults: stones }
}

export const StoneSearch = ({
  stone,
  setStone,
  onRetailPriceChange,
}: {
  stone: StoneSlim | undefined
  setStone: (value: StoneSlim | undefined) => void
  onRetailPriceChange?: (price: number) => void
}) => {
  const [searchValue, setSearchValue] = useState(stone?.name || undefined)
  const [show, setShow] = useState(!stone?.name)
  const { data, isLoading } = useQuery({
    queryKey: ['availableStones', searchValue],
    queryFn: () => fetchAvailableStones(searchValue),
    enabled: !!searchValue,
  })

  const handleStoneSelect = (stone: { id: number; name: string }) => {
    setStone({
      id: stone.id,
      type: data?.stoneType[stone.name] || '',
      name: stone.name,
    })

    const selectedStone = data?.stoneSearchResults?.find(s => s.id === stone.id)
    if (selectedStone && onRetailPriceChange) {
      onRetailPriceChange(selectedStone.retail_price || 0)
    }

    setSearchValue(stone.name)
    setShow(false)
  }

  const handleValueChange = (value: string) => {
    setSearchValue(value)
    if (show === false) {
      setShow(true)
    }
  }

  const handleRemoveStone = () => {
    setStone(undefined)
    setSearchValue('')
    setShow(false)
  }

  return (
    <div className='space-y-2'>
      <label className='text-sm font-medium'>Stone</label>

      <div className='relative'>
        {stone && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleRemoveStone}
            className='absolute -top-4 right-0 z-10 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 '
          >
            <X className='h-3 w-3' />
          </Button>
        )}
        <Input
          placeholder='Search stone colors...'
          value={searchValue || stone?.name || ''}
          disabled={!!stone?.name}
          onChange={e => handleValueChange(e.target.value)}
          className='w-full'
        />
        {isLoading && (
          <div className='absolute right-8 top-2'>
            <div className='animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent'></div>
          </div>
        )}
      </div>

      {/* Stone search results dropdown */}
      {show && (data?.stoneSearchResults?.length ?? 0) > 0 && (
        <div className=' -mt-2 absolute z-10 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg w-3/7'>
          <ul className='py-1 divide-y divide-gray-200'>
            {data?.stoneSearchResults?.map(stone => (
              <li
                key={stone.id}
                className='px-3 py-2 hover:bg-gray-50 cursor-pointer'
                onClick={() => handleStoneSelect(stone)}
              >
                {stone.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
