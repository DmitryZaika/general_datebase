import { useQuery } from '@tanstack/react-query'
import debounce from 'lodash.debounce'
import { Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { StoneSearchResult, StoneSlim } from '~/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { AddStoneQuickDialog } from './AddStoneQuickDialog'

const fetchAvailableStones = async (companyId: number, query: string = '') => {
  const response = await fetch(
    `/api/stones/search/${companyId}?name=${encodeURIComponent(query)}&unsold_only=true`,
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
  companyId,
  allowQuickAdd = false,
  onStoneCreated,
}: {
  stone: StoneSlim | undefined
  setStone: (value: StoneSlim | undefined) => void
  onRetailPriceChange?: (price: number) => void
  companyId: number
  allowQuickAdd?: boolean
  onStoneCreated?: (stone: StoneSlim, slabId?: number) => void
}) => {
  const [searchValue, setSearchValue] = useState(stone?.name || '')
  const [show, setShow] = useState(!stone?.name)
  const [showAddStoneDialog, setShowAddStoneDialog] = useState(false)

  const debouncedSetSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value)
      }, 300),
    [],
  )

  useEffect(() => {
    return () => {
      debouncedSetSearchValue.cancel()
    }
  }, [debouncedSetSearchValue])

  const handleValueChange = (value: string) => {
    debouncedSetSearchValue(value)
    if (!show) setShow(true)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['availableStones', companyId, searchValue],
    queryFn: () => fetchAvailableStones(companyId, searchValue),
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

  const handleRemoveStone = () => {
    setStone(undefined)
    setSearchValue('')
    setShow(false)
  }

  const handleNewStoneCreated = useCallback(
    (newStone: StoneSlim, slabId?: number) => {
      if (onStoneCreated) {
        onStoneCreated(newStone, slabId)
      }

      setStone(newStone)

      if (onRetailPriceChange && newStone.retail_price) {
        onRetailPriceChange(newStone.retail_price)
      }

      setSearchValue(newStone.name)
      setShow(false)
    },
    [setStone, onRetailPriceChange, onStoneCreated],
  )

  return (
    <div className='space-y-2'>
      <label className='text-sm font-medium'>Stone</label>

      <div className='flex gap-2'>
        <div className='relative flex-1'>
          {stone && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleRemoveStone}
              className='absolute h-6 w-6 -top-4 right-0 z-10 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 '
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
        {allowQuickAdd && !stone && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setShowAddStoneDialog(true)}
            className='h-9 w-9 p-0'
          >
            <Plus className='h-4 w-4' />
          </Button>
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
      <AddStoneQuickDialog
        show={showAddStoneDialog}
        setShow={setShowAddStoneDialog}
        companyId={companyId}
        onStoneCreated={handleNewStoneCreated}
      />
    </div>
  )
}
