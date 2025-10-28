import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface RawSelectProps<T> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  label?: string
}

export function RawSelect<T extends string>({
  options,
  value,
  onChange,
  label,
}: RawSelectProps<T>) {
  return (
    <div className='flex flex-col gap-1 w-full'>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className='min-w-[120px]'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface SelectOption<T extends string, V extends string> {
  key: T
  value: V
}

interface RawObjectSelectProps<T extends string, V extends string> {
  options: readonly SelectOption<T, V>[]
  value: T
  onChange: (value: T) => void
  label?: string
}

export function RawObjectSelect<T extends string, V extends string>({
  options,
  value,
  onChange,
  label,
}: RawObjectSelectProps<T, V>) {
  return (
    <div className='flex flex-col gap-1 w-full'>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className='min-w-[120px]'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.key} value={option.key}>
              {option.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
