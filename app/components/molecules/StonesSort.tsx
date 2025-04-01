import { Button } from "~/components/ui/button";
import { ReactNode, useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// Используем только три опции сортировки: имя по возрастанию и цена в обоих направлениях
export type SortOption = 'name_asc' | 'price_asc' | 'price_desc';

interface Stone {
  id: number;
  name: string;
  retail_price?: number;
  cost_per_sqft?: number;
  [key: string]: any;
}

export interface StonesSortProps<T extends Stone> {
  stones: T[];
  onSortedStones: (sortedStones: T[]) => void;
  priorityFn?: (a: T, b: T) => number;
  className?: string;
  children?: ReactNode;
}

export function StonesSort<T extends Stone>({ 
  stones, 
  onSortedStones, 
  priorityFn, 
  className = "",
  children
}: StonesSortProps<T>) {
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  
  useEffect(() => {
    // При изменении stones применяем текущую сортировку
    applySortOption(sortOption);
  }, [stones]);

  const handleSortChange = (value: string) => {
    const option = value as SortOption;
    setSortOption(option);
    applySortOption(option);
  };

  const applySortOption = (option: SortOption) => {
    const sorted = sortStones(stones, option, priorityFn);
    onSortedStones(sorted);
  };

  return (
    <div className="flex justify-between items-center w-full">
      <div className={`flex items-center gap-4 ${className}`}>
        <p className=" p-2 text-lg font-medium">Sort by:</p>
        <Select value={sortOption} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px] bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name (A-Z)</SelectItem>
            <SelectItem value="price_asc">Price (Low-High)</SelectItem>
            <SelectItem value="price_desc">Price (High-Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {children}
    </div>
  );
}

function sortStones<T extends Stone>(
  stones: T[], 
  sortOption: SortOption,
  priorityFn?: (a: T, b: T) => number
): T[] {
  return [...stones].sort((a, b) => {
    // Сначала применяем функцию приоритета, если она предоставлена
    if (priorityFn) {
      const priorityResult = priorityFn(a, b);
      if (priorityResult !== 0) {
        return priorityResult;
      }
    }

    // Применяем выбранную опцию сортировки
    switch (sortOption) {
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'price_asc':
        const priceA_asc = a.retail_price || a.cost_per_sqft || 0;
        const priceB_asc = b.retail_price || b.cost_per_sqft || 0;
        return priceA_asc - priceB_asc;
      case 'price_desc':
        const priceA_desc = a.retail_price || a.cost_per_sqft || 0;
        const priceB_desc = b.retail_price || b.cost_per_sqft || 0;
        return priceB_desc - priceA_desc;
      default:
        return 0;
    }
  });
} 