import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import type { UseFormReturn } from 'react-hook-form'
import type { TCustomerSchema } from '~/schemas/sales'

async function getSlabs(
  stoneId: number,
  slabIds: number[],
): Promise<
  {
    id: number
    bundle: string
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
  type SlabState = { id: number; bundle: string } | undefined
  const [selectedSlab, setSelectedSlab] = useState<SlabState>()

  const allRooms = form.watch('rooms')
  const addedSlabIds = allRooms.flatMap(room => room.slabs.map(slab => slab.id))

  const { data = [] } = useQuery({
    queryKey: ['slabs', stoneId, addedSlabIds],
    queryFn: () => getSlabs(stoneId, addedSlabIds),
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
                {data.map(slab => (
                  <SelectItem key={slab.id} value={slab.bundle}>
                    {slab.bundle}
                  </SelectItem>
                ))}
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
