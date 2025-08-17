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

export function SalesRepsFilter() {
  const [names, setNames] = useState<string[]>(cachedNames ?? ['All'])
  const location = useLocation()
  const navigate = useNavigate()

  const current = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('salesRep') || 'All'
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
    <div className='px-2 py-2'>
      <div className='text-xs text-slate-500 mb-1'>Sales Rep</div>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className='h-8'>
          <SelectValue placeholder='Sales Rep' />
        </SelectTrigger>
        <SelectContent>
          {names.map(name => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
