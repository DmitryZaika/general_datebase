import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { TCustomerSchema } from '~/schemas/sales'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

async function getSlabs(
  stoneId: number,
  slabIds: number[],
): Promise<
  {
    id: number
    bundle: string
    is_leftover: boolean
    parent_id: number | null
    child_count: number
  }[]
> {
  const cleanParam = encodeURIComponent(JSON.stringify(slabIds))
  const response = await fetch(
    `/api/stones/${stoneId}/slabs?exclude=${cleanParam}&available=true`,
  )
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data = await response.json()
  return data.slabs
}

export const AddSlabDialog = ({
  show,
  setShow,
  form,
  stoneId,
  roomIndex,
}: {
  show: boolean
  setShow: (show: boolean) => void
  form: UseFormReturn<TCustomerSchema>
  stoneId: number
  roomIndex: number
}) => {
  type SlabState =
    | { id: number; bundle: string; is_leftover: boolean; parent_id: number | null; child_count: number }
    | undefined
  const [selectedSlab, setSelectedSlab] = useState<SlabState>()

  // Only exclude slabs that are already in the CURRENT room
  // Allow the same slab to be selected for different rooms
  const currentRoomSlabs = form.watch(`rooms.${roomIndex}.slabs`)
  const currentRoomSlabIds = currentRoomSlabs.map(slab => slab.id)

  const { data = [] } = useQuery({
    queryKey: ['slabs', stoneId, JSON.stringify(currentRoomSlabIds)],
    queryFn: () => getSlabs(stoneId, currentRoomSlabIds),
    enabled: !!stoneId && show,
  })

  const handleAddSlab = () => {
    if (!selectedSlab) {
      return
    }
    form.setValue(`rooms.${roomIndex}.slabs`, [
      ...form.getValues(`rooms.${roomIndex}.slabs`),
      {
        id: selectedSlab.id,
        is_full: false,
      },
    ])
    setSelectedSlab(undefined)
    setShow(false)
  }

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add Slab</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {data.length === 0 ? (
            <div className='text-center py-4 text-gray-500'>
              No available slabs found for this stone
            </div>
          ) : (
            <Select
              value={selectedSlab?.bundle || ''}
              onValueChange={val =>
                setSelectedSlab(data.find(slab => slab.bundle === val))
              }
            >
              <SelectTrigger className='min-w-[150px]'>
                <SelectValue placeholder='Select a slab' />
              </SelectTrigger>
              <SelectContent>
                {data.map(slab => {
                  const isPartial = slab.parent_id !== null || slab.child_count > 0
                  return (
                    <SelectItem key={slab.id} value={slab.bundle}>
                      <div className='flex items-center gap-2'>
                        <span>{slab.bundle}</span>
                        {isPartial && (
                          <span className='px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-medium'>
                            Partial
                          </span>
                        )}
                        {slab.is_leftover && (
                          <span className='px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800 font-medium'>
                            Leftover
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddSlab} disabled={!selectedSlab}>
            Add Slab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
