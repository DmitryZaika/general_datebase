import { type ReactNode, useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export type SortOption = 'name_asc' | 'price_asc' | 'price_desc'

interface Stone {
  id: number
  name: string
  retail_price?: number
  cost_per_sqft?: number
  available?: number
  is_display?: boolean | number
  [key: string]: any
}

export interface StonesSortProps<T extends Stone> {
  stones: T[]
  onSortedStones: (sortedStones: T[]) => void
  priorityFn?: (a: T, b: T) => number
  className?: string
  children?: ReactNode
}

export function StonesSort<T extends Stone>({
  stones,
  onSortedStones,
  priorityFn,
  className = '',
  children,
}: StonesSortProps<T>) {
  const [sortOption, setSortOption] = useState<SortOption>('name_asc')

  useEffect(() => {
    applySortOption('name_asc')
  }, [])

  useEffect(() => {
    applySortOption(sortOption)
  }, [stones])

  const handleSortChange = (value: string) => {
    const option = value as SortOption
    setSortOption(option)
    applySortOption(option)
  }

  const applySortOption = (option: SortOption) => {
    const sorted = sortStones(stones, option, priorityFn)

    const inStock = sorted.filter(
      stone => Number(stone.available) > 0 && Boolean(stone.is_display),
    )
    const outOfStock = sorted.filter(
      stone => Number(stone.available) <= 0 && Boolean(stone.is_display),
    )
    const notDisplayed = sorted.filter(stone => !stone.is_display)

    onSortedStones([...inStock, ...outOfStock, ...notDisplayed])
  }

  return (
    <div className=' px-1 flex justify-between items-center w-full'>
      <div className={`flex items-center gap-4 ${className}`}>
        <p className='text-lg font-medium'>Sort by:</p>
        <Select value={sortOption} onValueChange={handleSortChange}>
          <SelectTrigger className='w-[180px] bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary'>
            <SelectValue placeholder='Sort by...' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='name_asc'>Name (A-Z)</SelectItem>
            <SelectItem value='price_asc'>Price (Low-High)</SelectItem>
            <SelectItem value='price_desc'>Price (High-Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {children}
    </div>
  )
}

function sortStones<T extends Stone>(
  stones: T[],
  sortOption: SortOption,
  priorityFn?: (a: T, b: T) => number,
): T[] {
  return [...stones].sort((a, b) => {
    const aAvailable = Number(a.available) || 0
    const bAvailable = Number(b.available) || 0

    if (aAvailable > 0 && bAvailable <= 0) return -1
    if (aAvailable <= 0 && bAvailable > 0) return 1

    const aDisplayed = Boolean(a.is_display)
    const bDisplayed = Boolean(b.is_display)

    if (aAvailable <= 0 && bAvailable <= 0) {
      // Оба out of stock, сортируем по display
      if (aDisplayed && !bDisplayed) return -1
      if (!aDisplayed && bDisplayed) return 1
    }

    // Третий приоритет: дополнительная функция сортировки, если передана
    if (priorityFn) {
      const priorityResult = priorityFn(a, b)
      if (priorityResult !== 0) {
        return priorityResult
      }
    }

    // Четвертый приоритет: сортировка по выбранному критерию
    switch (sortOption) {
      case 'name_asc':
        return a.name.localeCompare(b.name)
      case 'price_asc': {
        const priceA_asc = Number(a.retail_price) || Number(a.cost_per_sqft) || 0
        const priceB_asc = Number(b.retail_price) || Number(b.cost_per_sqft) || 0
        return priceA_asc - priceB_asc
      }
      case 'price_desc': {
        const priceA_desc = Number(a.retail_price) || Number(a.cost_per_sqft) || 0
        const priceB_desc = Number(b.retail_price) || Number(b.cost_per_sqft) || 0
        return priceB_desc - priceA_desc
      }
      default:
        return 0
    }
  })
}
