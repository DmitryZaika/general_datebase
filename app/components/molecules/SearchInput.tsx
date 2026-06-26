import { Search, X } from 'lucide-react'
import { forwardRef } from 'react'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  clearable?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(props, ref) {
    const showClear = props.clearable && props.value.length > 0
    return (
      <div className={cn('relative', props.className)}>
        <Search
          size={14}
          className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'
        />
        <Input
          ref={ref}
          aria-label={props['aria-label'] ?? 'Search'}
          autoFocus={props.autoFocus}
          placeholder={props.placeholder ?? 'Search…'}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          className={cn('pl-8 h-9 text-sm', showClear && 'pr-8')}
        />
        {showClear && (
          <button
            type='button'
            aria-label='Clear search'
            onClick={() => props.onChange('')}
            className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
          >
            <X size={14} />
          </button>
        )}
      </div>
    )
  },
)
