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

  const handleAddSink = () => {
    if (!selectedSink) {
      return
    }
    form.setValue(`rooms.${roomIndex}.sink_type`, [
      ...form.getValues(`rooms.${roomIndex}.sink_type`),
      {
        id: selectedSink,
      },
    ])
    setShow(false)
  }

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {sink_type.length === 0 ? (
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
                {sink_type.map(sink => (
                  <SelectItem key={sink.id} value={sink.id.toString()}>
                    {sink.name} - ${sink.retail_price}
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
