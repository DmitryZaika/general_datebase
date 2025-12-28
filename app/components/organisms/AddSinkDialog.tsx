import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { TCustomerSchema } from '~/schemas/sales'
import type { Sink } from '~/types'
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

export const AddSinkDialog = ({
  show,
  setShow,
  form,
  roomIndex,
  sink_type,
}: {
  show: boolean
  setShow: (show: boolean) => void
  form: UseFormReturn<TCustomerSchema>
  roomIndex: number
  sink_type: Sink[]
}) => {
  const [selectedSink, setSelectedSink] = useState<number>()

  const allRooms = form.getValues('rooms') || []
  const allSelectedSinks = allRooms.flatMap(room => room.sink_type || [])

  // Count how many of each sink type are already selected
  const selectedSinkCounts = new Map<number, number>()
  allSelectedSinks.forEach(sink => {
    selectedSinkCounts.set(
      sink.type_id,
      (selectedSinkCounts.get(sink.type_id) || 0) + 1,
    )
  })

  // Calculate remaining available for each sink type
  const sinksWithRemaining = sink_type
    .map(sink => {
      const totalAvailable = Number(sink.sink_count) || 0
      const alreadySelected = selectedSinkCounts.get(sink.id) || 0
      const remaining = totalAvailable - alreadySelected

      return {
        ...sink,
        remaining,
      }
    })
    .filter(sink => sink.remaining > 0) // Only show sinks with availability

  const handleAddSink = () => {
    if (!selectedSink) {
      return
    }

    // Add sink to form
    form.setValue(`rooms.${roomIndex}.sink_type`, [
      ...(form.getValues(`rooms.${roomIndex}.sink_type`) || []),
      {
        type_id: selectedSink,
        price: sink_type.find(s => s.id === selectedSink)?.retail_price || 0,
      },
    ])

    setSelectedSink(undefined)
    setShow(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedSink(undefined) // Reset selection when closing
    }
    setShow(open)
  }

  return (
    <Dialog open={show} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {sinksWithRemaining.length === 0 ? (
            <div className='text-center py-4 text-gray-500'>
              No available sinks found
            </div>
          ) : (
            <Select
              value={selectedSink?.toString() || ''}
              onValueChange={val => setSelectedSink(parseInt(val))}
            >
              <SelectTrigger className='min-w-[150px]'>
                <SelectValue placeholder='Select a sink' />
              </SelectTrigger>
              <SelectContent>
                {sinksWithRemaining.map(sink => (
                  <SelectItem key={sink.id} value={sink.id.toString()}>
                    {sink.name} - ${sink.retail_price} (avail: {sink.remaining})
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
          <Button onClick={handleAddSink} disabled={!selectedSink}>
            Add Sink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
