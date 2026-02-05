import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

let cachedNames: string[] | null = null

export function SalesRepsFilter({ className }: { className?: string }) {
  const [names, setNames] = useState<string[]>(cachedNames ?? ['All'])
  const location = useLocation()
  const navigate = useNavigate()

  const current = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const val = params.get('salesRep')
    return val === 'All' ? undefined : val || undefined
  }, [location.search])

  useEffect(() => {
    if (cachedNames) return
    let ignore = false
    async function load() {
      const res = await fetch('/api/sales-reps')
      if (!res.ok) return
      const data: { users: { id: number; name: string }[] } = await res.json()
      if (ignore) return
      cachedNames = ['All', ...data.users.map(u => u.name)]
      setNames(cachedNames)
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const onChange = (value: string) => {
    if (value === current) return
    const params = new URLSearchParams(location.search)
    if (value === 'All') params.delete('salesRep')
    else params.set('salesRep', value)
    const qs = params.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className={`px-2  mt-2 min-w-30 ${className}`}>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className='h-9'>
          <SelectValue placeholder='Sales Rep' />
        </SelectTrigger>
        <SelectContent>
          {names.map(name => (
            <SelectItem key={name} value={name}>
              {name || 'Select Value'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
