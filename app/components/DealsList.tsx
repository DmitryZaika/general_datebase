import { useDroppable } from '@dnd-kit/core'
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
    amount?: number | null
    description?: string | null
    list_id: number
    position?: number
    due_date?: string | null
  }[]
  id: number
  readonly?: boolean
}

export default function DealsList({
  title,
  customers,
  id,
  readonly = false,
}: DealsListProps) {
  const locked = readonly || [1, 2, 3, 4, 5, 6].includes(id) // Lock all in readonly
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const { setNodeRef } = useDroppable({
    id: `list-${id}`,
    data: { type: 'list', listId: id },
  })

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
    <Card
      ref={setNodeRef}
      className={`min-w-[18rem] w-72 max-h-[calc(100vh-7rem)] flex flex-col h-full shadow-sm ${id === 4 ? 'bg-green-100' : id === 5 ? 'bg-red-100' : ''}`}
    >
      <CardHeader className='bg-black rounded-t-xl py-2 px-4'>
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
              className='text-sm font-semibold tracking-wide text-white w-full'
              onClick={e => {
                if (locked) return
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {value}
            </CardTitle>
          )}
          {!locked && (
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
          )}
        </div>
      </CardHeader>
      <DealsCard customers={customers} readonly={readonly} />
      {!readonly && (
        <div className='p-3 border-t'>
          <Link to={`add?list_id=${id}`} relative='path'>
            <Button variant='ghost' type='button' className='w-full flex gap-2'>
              <Plus className='w-4 h-4' /> Add Deal
            </Button>
          </Link>
        </div>
      )}
    </Card>
  )
}
