import React from 'react'
import { InputItem } from '~/components/molecules/InputItem'
import type { ControllerRenderProps } from 'react-hook-form'

interface PhoneInputProps {
  field: ControllerRenderProps<any, any>
  formClassName?: string
  disabled?: boolean
}

const formatPhoneNumber = (value: string, isDeleting: boolean = false) => {
  // Если пользователь удаляет символы, не форматируем автоматически
  if (isDeleting) {
    // Просто убираем лишние символы кроме цифр и дефисов
    return value.replace(/[^\d-]/g, '').slice(0, 12) // 10 цифр + 2 дефиса
  }

  // Убираем все символы кроме цифр
  const phoneNumber = value.replace(/[^\d]/g, '')

  // Ограничиваем до 10 цифр
  const truncated = phoneNumber.slice(0, 10)

  // Форматируем как 317-255-1414 только если есть достаточно цифр
  if (truncated.length >= 6) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3, 6)}-${truncated.slice(6)}`
  } else if (truncated.length >= 3) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3)}`
  }

  return truncated
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  field,
  formClassName,
  disabled,
}) => {
  const [lastValue, setLastValue] = React.useState(field.value || '')

  React.useEffect(() => {
    setLastValue(field.value || '')
  }, [field.value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const isDeleting = newValue.length < lastValue.length
    const formatted = formatPhoneNumber(newValue, isDeleting)

    setLastValue(formatted)
    field.onChange(formatted)
  }

  return (
    <InputItem
      name='Phone'
      placeholder='317-255-1414'
      field={{
        ...field,
        onChange: handleChange,
        disabled: disabled,
      }}
      formClassName={formClassName}
    />
  )
}
