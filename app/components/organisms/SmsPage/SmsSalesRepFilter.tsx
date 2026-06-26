import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { SmsSalesRep } from '~/utils/cloudtalkSmsService.server'

export interface SmsSalesRepFilterProps {
  salesReps: SmsSalesRep[]
  value: string
  onChange: (agentId: string) => void
}

export function SmsSalesRepFilter({
  salesReps,
  value,
  onChange,
}: SmsSalesRepFilterProps) {
  if (salesReps.length === 0) return null

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='w-full h-8 bg-white text-xs'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>All</SelectItem>
        {salesReps.map(rep => (
          <SelectItem key={rep.agentId} value={rep.agentId}>
            {rep.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
