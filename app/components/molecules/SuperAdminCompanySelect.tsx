import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface SuperAdminCompanySelectProps {
  companies: { id: number; name: string }[]
  activeCompanyId?: number
  currentCompanyId?: number | string
  onCompanyChange: (companyId: string) => void
  className?: string
}

export function SuperAdminCompanySelect({
  companies,
  activeCompanyId,
  currentCompanyId,
  onCompanyChange,
  className = 'w-48',
}: SuperAdminCompanySelectProps) {
  return (
    <Select
      value={
        activeCompanyId?.toString() ??
        (companies.some(c => c.id === Number(currentCompanyId))
          ? String(currentCompanyId)
          : companies[0].id.toString())
      }
      onValueChange={onCompanyChange}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder='Switch Company' />
      </SelectTrigger>
      <SelectContent>
        {companies.map(company => (
          <SelectItem key={company.id} value={company.id.toString()}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
