import type React from 'react'
import { useEffect, useRef, useState } from 'react'
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

type Option = { key: string; value: string }

interface SelectInputOtherProps<TFieldValues extends FieldValues = FieldValues> {
  name: string
  placeholder?: string
  field: ControllerRenderProps<TFieldValues>
  disabled?: boolean
  options: Array<string | { key: string | number; value: string }>
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
  const [isOtherSelected, setIsOtherSelected] = useState(false)
  const [otherValue, setOtherValue] = useState('')
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  // Convert all option keys to strings
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

  // Add "Other" option only if it doesn't already exist
  const otherOptionExists = cleanOptions.some(
    option => option.key.toLowerCase() === 'other' || option.value === 'Other',
  )

  if (!otherOptionExists) {
    cleanOptions.push({ key: 'other', value: 'Other' })
  }

  // Get a display-friendly value from an option by key
  const getDisplayValue = (key: string) => {
    const option = cleanOptions.find(opt => opt.key.toLowerCase() === key.toLowerCase())
    return option ? option.value : key
  }

  // Initialize or update based on field.value changes
  useEffect(() => {
    if (!field.value) return

    const valueStr = String(field.value).toLowerCase()
    const foundOption = cleanOptions.find(opt => opt.key.toLowerCase() === valueStr)

    if (foundOption) {
      setSelectedValue(foundOption.key)
      setIsOtherSelected(false)
    } else if (valueStr !== 'other') {
      setIsOtherSelected(true)
      setOtherValue(field.value as string)
      setSelectedValue('other')
    }
    if (defaultValue && !selectedValue) {
      // Only set from defaultValue if we don't already have a value
      const defaultValueLower = defaultValue.toLowerCase()
      const foundOption = cleanOptions.find(
        opt =>
          opt.key.toLowerCase() === defaultValueLower ||
          opt.value.toLowerCase() === defaultValueLower,
      )

      if (foundOption) {
        setSelectedValue(foundOption.key)
        setIsOtherSelected(false)
        field.onChange(foundOption.key) // Update form value
      } else {
        setIsOtherSelected(true)
        setOtherValue(defaultValue)
        setSelectedValue('other')
        field.onChange(defaultValue) // Update form value
      }
    }
  }, [field.value, cleanOptions, defaultValue, field, selectedValue])

  // Add effect to focus input when "Other" is selected
  useEffect(() => {
    if (isOtherSelected && inputRef.current) {
      // Небольшая задержка, чтобы дать DOM время обновиться
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOtherSelected])

  // Handle value change from dropdown
  const handleValueChange = (value: string) => {
    if (value === 'other') {
      setIsOtherSelected(true)
      setSelectedValue('other')
      field.onChange(otherValue || '')
    } else {
      setIsOtherSelected(false)
      setSelectedValue(value)
      field.onChange(value)
    }
  }

  // Handle other input change
  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setOtherValue(newValue)
    field.onChange(newValue)
  }

  // Determine what to display in the UI
  const selectDisplayValue =
    selectedValue || (field.value ? String(field.value).toLowerCase() : undefined)

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        {isOtherSelected ? (
          <Input
            ref={inputRef}
            placeholder='Enter custom value'
            value={otherValue}
            onChange={handleOtherChange}
            disabled={disabled}
            onBlur={() => {
              if (!otherValue.trim()) {
                setIsOtherSelected(false)
                setSelectedValue(cleanOptions[0]?.key || '')
                field.onChange(cleanOptions[0]?.key || '')
              }
            }}
          />
        ) : (
          <Select
            value={selectDisplayValue}
            onValueChange={handleValueChange}
            disabled={disabled}
          >
            <SelectTrigger className='min-w-[150px]'>
              <SelectValue placeholder={placeholder || 'Select Item'}>
                {selectDisplayValue
                  ? getDisplayValue(selectDisplayValue)
                  : placeholder || 'Select Item'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cleanOptions.map(({ key, value }) => (
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
