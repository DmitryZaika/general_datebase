import { useState } from 'react'
import type { ControllerRenderProps, FieldValues } from 'react-hook-form'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

interface SelectInputOtherProps<TFieldValues extends FieldValues = FieldValues> {
  name: string
  placeholder?: string
  field: ControllerRenderProps<TFieldValues>
  disabled?: boolean
  options: { key: TFieldValues; value: string }[]
  className?: string
  defaultValue?: string
}

export function SelectInputOther<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
  defaultValue,
}: SelectInputOtherProps<TFieldValues>) {
  const fullOptions = [...options, { key: 'other', value: 'Other' }]
  const asList = fullOptions.map(({ key }) => key)
  const [isOtherSelected, setIsOtherSelected] = useState(!asList.includes(field.value))

  const handleValueChange = (value: string) => {
    if (value === 'other') {
      setIsOtherSelected(true)
      field.onChange('')
      return
    }
    field.onChange(value)
  }

  const handleInputBlur = () => {
    if (!field.value.trim()) {
      setIsOtherSelected(false)
      field.onChange(options[0]?.key.toString() || '')
    }
  }

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        {isOtherSelected ? (
          <Input
            placeholder='Enter custom value'
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            onBlur={handleInputBlur}
            autoFocus
          />
        ) : (
          <Select
            value={field.value || defaultValue}
            onValueChange={handleValueChange}
            disabled={disabled}
          >
            <SelectTrigger className='min-w-[150px]'>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {fullOptions.map(({ key, value }) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
