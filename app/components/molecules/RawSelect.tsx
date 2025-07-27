import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface RawSelectProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

export function RawSelect<T extends string>({
  options,
  value,
  onChange,
}: RawSelectProps<T>) {
  return (
    <div className='flex flex-col gap-2 w-1/2'>
      <Label>Customer</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className='min-w-[150px]'>
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
