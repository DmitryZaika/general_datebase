import React from 'react'
import type { ControllerRenderProps, FieldValues } from 'react-hook-form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

type Option = { key: string | number; value: string }

interface SelectInputProps<TFieldValues extends FieldValues = FieldValues> {
  name: string
  placeholder?: string
  field: ControllerRenderProps<TFieldValues>
  disabled?: boolean
  options: Array<string | Option>
  className?: string
  defaultValue?: string
}

export function SelectInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
  defaultValue,
}: SelectInputProps<TFieldValues>) {
  const cleanOptions: Option[] = options.map(option => {
    if (typeof option === 'string') {
      return { key: option.toLowerCase(), value: option }
    } else {
      const { key, value } = option
      return {
        key: typeof key === 'string' ? key.toLowerCase() : String(key),
        value,
      }
    }
  })

  // If there's no value set yet but there is a defaultValue, use it
  React.useEffect(() => {
    if (!field.value && defaultValue) {
      const defaultValueLower = defaultValue.toLowerCase()
      const foundOption = cleanOptions.find(opt => {
        const optKey =
          typeof opt.key === 'string'
            ? opt.key.toLowerCase()
            : String(opt.key).toLowerCase()

        return (
          optKey === defaultValueLower || opt.value.toLowerCase() === defaultValueLower
        )
      })

      if (foundOption) {
        field.onChange(String(foundOption.key))
      }
    }
  }, [defaultValue, field, cleanOptions])

  const selectValue = String(field.value ?? '')

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        <Select
          value={selectValue}
          onValueChange={val => field.onChange(val)}
          disabled={disabled}
        >
          <SelectTrigger className='min-w-[150px]'>
            <SelectValue placeholder={placeholder || 'Select Item'} />
          </SelectTrigger>
          <SelectContent>
            {cleanOptions.map(({ key, value }) => (
              <SelectItem key={String(key)} value={String(key)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
