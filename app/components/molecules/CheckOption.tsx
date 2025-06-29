import { Checkbox } from '~/components/ui/checkbox'
import type { ReactNode } from 'react'

interface ICheckOptionProps<T> {
  value: T
  selected: boolean
  toggleValue: (val: T) => void
  isLoading?: boolean
  defaultChecked?: boolean
  icon?: ReactNode
}

export function CheckOption<T>({
  value,
  selected,
  toggleValue,
  defaultChecked,
  isLoading = false,
  icon,
}: ICheckOptionProps<T>) {
  const id = `checkbox-${value as string}`

  return (
    <div
      className={`flex items-center space-x-1 rounded hover:bg-gray-100 
        ${isLoading ? 'opacity-60' : 'cursor-pointer'} 
        transition-all duration-150 w-full`}
      onClick={() => !isLoading && toggleValue(value)}
    >
      <Checkbox
        className='cursor-pointer'
        id={id}
        checked={selected}
        disabled={isLoading}
        onClick={e => e.stopPropagation()}
        onCheckedChange={() => toggleValue(value)}
        defaultChecked={defaultChecked}
      />
      <div className='grid p-1.5 leading-none capitalize w-full'>
        <label
          htmlFor={id}
          className='text-sm font-medium leading-none cursor-pointer 
            peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center'
        >
          {icon}
          {value as string}
        </label>
      </div>
    </div>
  )
}
