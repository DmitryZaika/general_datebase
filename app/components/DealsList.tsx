import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import DealsCard from './DealsCard'
import { ActionDropdown } from './molecules/DataTable/ActionDropdown'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'

interface DealsListProps {
  title: string
  customers: {
    id: number
    name: string
    amount?: number
    description?: string
    list_id?: number
    position?: number
  }[]
  id: number
}

export default function DealsList({ title, customers, id }: DealsListProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  async function save() {
    if (value.trim() === '' || value === title) {
      setEditing(false)
      return
    }
    await fetch('/api/deals-list/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: value }),
    })
    setEditing(false)
  }
  return (
    <Card className='w-72 flex flex-col h-full shadow-sm'>
      <CardHeader className={` bg-black rounded-t-xl py-2 px-4`}>
        <div className='flex justify-between items-center'>
          {editing ? (
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              onBlur={save}
              onKeyDown={e => e.key === 'Enter' && save()}
              className='text-sm font-semibold tracking-wide bg-white text-black rounded px-1 outline-none'
              autoFocus
            />
          ) : (
            <CardTitle
              className='text-sm font-semibold tracking-wide text-white cursor-pointer w-full'
              onClick={e => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {value}
            </CardTitle>
          )}
          <div className='flex gap-2 items-center'>
            <span className='text-xs font-medium text-white/90 bg-white/20 rounded-full px-2 py-0.5'>
              {customers.length}
            </span>
            <ActionDropdown
              actions={{ edit: `edit-list/${id}`, delete: `delete/${id}` }}
              label='List actions'
              className='!text-white hover:!text-black'
              wrapperClassName='!pr-0'
            />
          </div>
        </div>
      </CardHeader>
      <DealsCard customers={customers} />
      <div className='p-3 border-t'>
        <Link to={`add?list_id=${id}`} relative='path'>
          <Button variant='ghost' type='button' className={` w-full flex gap-2 `}>
            <Plus className='w-4 h-4' />
            Add Deal
          </Button>
        </Link>
      </div>
    </Card>
  )
}
