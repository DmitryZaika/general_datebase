import { format } from 'date-fns'
import { useState } from 'react'
import { Button } from '../ui/button'

type ReassignmentRow = {
  reassigned_by: string | null
  reassigned_to: string | null
  updated_at: string
}

type CustomerHistoryProps = {
  created_by: string | null
  created_date: string | null
  source?: string | null
  initial_sales_rep_name?: string | null
  assigned_date?: string | null
  first_rep_deal_created_at?: string | null
  reassignments?: ReassignmentRow[]
}

export function CustomerHistorySection({
  created_by,
  created_date,
  source = null,
  initial_sales_rep_name = null,
  assigned_date = null,
  first_rep_deal_created_at = null,
  reassignments = [],
}: CustomerHistoryProps) {
  const [expanded, setExpanded] = useState(false)
  type Item = { sortKey: number; text: string }
  const items: Item[] = []

  const sourceNorm = source?.trim().toLowerCase() ?? ''
  const noCreatedBy = !created_by?.trim()
  const isLeadWithoutCreator = sourceNorm === 'leads' && noCreatedBy
  const initialRep = initial_sales_rep_name?.trim() ?? ''

  if (isLeadWithoutCreator) {
    const createdAt = created_date ? new Date(created_date) : null
    const t0 = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : 0
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      items.push({
        sortKey: t0,
        text: `Customer added as a lead on ${format(createdAt, 'M/d/yyyy h:mm a')}`,
      })
    } else {
      items.push({
        sortKey: 0,
        text: 'Customer added as a lead',
      })
    }

    if (reassignments.length === 0 && initialRep.length > 0) {
      const assignedAt = assigned_date
        ? new Date(assigned_date)
        : first_rep_deal_created_at
          ? new Date(first_rep_deal_created_at)
          : null
      const assignedValid = assignedAt && !Number.isNaN(assignedAt.getTime())
      items.push({
        sortKey: assignedValid ? assignedAt.getTime() : t0 + 1,
        text: assignedValid
          ? `Assigned to ${initialRep} by sales manager on ${format(assignedAt, 'M/d/yyyy h:mm a')}`
          : `Assigned to ${initialRep} by sales manager`,
      })
    }
  } else {
    const creator = created_by?.trim()
    if (creator) {
      const createdAt = created_date ? new Date(created_date) : null
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        items.push({
          sortKey: createdAt.getTime(),
          text: `Customer created by ${creator} on ${format(createdAt, 'M/d/yyyy h:mm a')}`,
        })
      } else {
        items.push({
          sortKey: 0,
          text: `Customer created by ${creator}`,
        })
      }
    }
  }

  for (const r of reassignments) {
    const by = r.reassigned_by?.trim()
    if (!by) continue
    const at = new Date(r.updated_at)
    if (Number.isNaN(at.getTime())) continue
    const to = r.reassigned_to?.trim()
    const text = to
      ? `Assigned to ${to} by ${by} on ${format(at, 'M/d/yyyy h:mm a')}`
      : `Assigned by ${by} on ${format(at, 'M/d/yyyy h:mm a')}`
    items.push({
      sortKey: at.getTime(),
      text,
    })
  }

  items.sort((a, b) => a.sortKey - b.sortKey)

  if (items.length === 0) {
    return null
  }

  const overLimit = items.length > 3
  const visible = overLimit && !expanded ? items.slice(0, 3) : items

  return (
    <div className='border rounded p-4'>
      <div className='text-md font-semibold mb-2'>History</div>
      <ul className='list-disc list-inside space-y-1 text-sm text-slate-600'>
        {visible.map((item, i) => (
          <li key={`${item.sortKey}-${i}`}>{item.text}</li>
        ))}
        {overLimit && !expanded && (
          <li className='list-none -translate-x-[1.1em] mt-1 text-center pt-1'>
            <Button
              type='button'
              className='font-medium'
              onClick={() => setExpanded(true)}
            >
              Show more
            </Button>
          </li>
        )}
        {overLimit && expanded && (
          <li className='list-none -translate-x-[1.1em] mt-1 text-center pt-1'>
            <Button
              type='button'
              className='font-medium'
              onClick={() => setExpanded(false)}
            >
              Show less
            </Button>
          </li>
        )}
      </ul>
    </div>
  )
}
