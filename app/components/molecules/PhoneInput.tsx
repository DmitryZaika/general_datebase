import React from 'react'
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form'
import { InputItem } from '~/components/molecules/InputItem'
import { formatPhoneInput } from '~/utils/phone'

interface PhoneInputProps<T extends FieldValues, V extends Path<T>> {
  field: ControllerRenderProps<T, V>
  formClassName?: string
  disabled?: boolean
  inputName: string
}

export const PhoneInput = <T extends FieldValues, V extends Path<T>>({
  field,
  formClassName,
  disabled,
  inputName,
}: PhoneInputProps<T, V>) => {
  const [lastValue, setLastValue] = React.useState(field.value || '')

  React.useEffect(() => {
    setLastValue(field.value || '')
  }, [field.value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const isDeleting = newValue.length < lastValue.length
    const formatted = formatPhoneInput(newValue, isDeleting)

    setLastValue(formatted)
    field.onChange(formatted)
  }

  return (
    <InputItem
      name={`${inputName}`}
      placeholder='123-456-7890'
      type='tel'
      field={{
        ...field,
        onChange: handleChange,
        inputMode: 'numeric',
        pattern: '[-0-9]*',
        disabled: disabled,
      }}
      formClassName={formClassName}
    />
  )
}
