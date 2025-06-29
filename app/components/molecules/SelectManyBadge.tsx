import React, { useState } from 'react'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'
import type { FieldValues, ControllerRenderProps } from 'react-hook-form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Badge } from '../ui/badge'
import { Check } from 'lucide-react'

type Option = { key: string | number; value: string }

interface SelectManyBadgeProps<TFieldValues extends FieldValues = FieldValues> {
  name: string
  placeholder?: string
  field: ControllerRenderProps<TFieldValues>
  disabled?: boolean
  options: Option[]
  className?: string
  badges: Record<string, string>
  showCheckmarks?: boolean
}

export function SelectManyBadge<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
  badges,
  showCheckmarks = false,
}: SelectManyBadgeProps<TFieldValues>) {
  const selectedValues: string[] = Array.isArray(field.value)
    ? field.value
    : field.value
      ? [field.value]
      : []

  const [open, setOpen] = useState(false)

  function handleChange(val: string) {
    if (!val) return

    if (!selectedValues.includes(val)) {
      field.onChange([...selectedValues, val])
    }

    setTimeout(() => setOpen(true), 0)
  }

  function handleRemove(val: string) {
    field.onChange(selectedValues.filter(v => v !== val))
  }

  function isLightColor(color: string) {
    const hex = color.replace('#', '')
    const c_r = parseInt(hex.substring(0, 2), 16)
    const c_g = parseInt(hex.substring(2, 4), 16)
    const c_b = parseInt(hex.substring(4, 6), 16)
    const brightness = (c_r * 299 + c_g * 587 + c_b * 114) / 1000
    return brightness > 155
  }

  return (
    <FormItem className={`${className}`}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        <Select
          onValueChange={handleChange}
          disabled={disabled}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger className='min-w-[150px]'>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ key, value }) => {
              const isSelected = selectedValues.includes(String(key))
              return (
                <div className='relative flex items-center' key={key}>
                  <SelectItem value={String(key)}>{value}</SelectItem>
                  {!showCheckmarks && isSelected && (
                    <span className='absolute right-2 flex h-3.5 w-3.5 items-center justify-center'>
                      <Check className='h-4 w-4' />
                    </span>
                  )}
                </div>
              )
            })}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
      <div className='flex flex-wrap gap-1 min-h-[22px]'>
        {Object.entries(badges).map(([itemName, color]) => {
          const option = options.find(opt => opt.value === itemName)
          if (!option) return null

          return (
            <Badge
              key={itemName}
              className='flex items-center gap-1 cursor-pointer select-none'
              style={{
                backgroundColor: color,
                color: isLightColor(color) ? '#000000' : '#ffffff',
              }}
              onClick={() => handleRemove(String(option.key))}
            >
              {itemName}
              <span className='ml-1'>×</span>
            </Badge>
          )
        })}
      </div>
    </FormItem>
  )
}
