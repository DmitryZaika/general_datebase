import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { TCustomerSchema } from '~/schemas/sales'
import type { Faucet } from '~/types'
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

export const AddFaucetDialog = ({
  show,
  setShow,
  form,
  roomIndex,
  faucet_type,
}: {
  show: boolean
  setShow: (show: boolean) => void
  form: UseFormReturn<TCustomerSchema>
  roomIndex: number
  faucet_type: Faucet[]
}) => {
  const [selectedFaucet, setSelectedFaucet] = useState<number>()

  const handleAddFaucet = () => {
    if (!selectedFaucet) {
      return
    }
    const currentFaucets = form.getValues(`rooms.${roomIndex}.faucet_type`) || []
    form.setValue(`rooms.${roomIndex}.faucet_type`, [
      ...currentFaucets,
      {
        type_id: selectedFaucet,
      },
    ])
    setShow(false)
  }

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add Faucet</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {faucet_type.length === 0 ? (
            <div className='text-center py-4 text-gray-500'>
              No available faucets found
            </div>
          ) : (
            <Select
              value={selectedFaucet?.toString() || ''}
              onValueChange={val => setSelectedFaucet(parseInt(val))}
            >
              <SelectTrigger className='min-w-[150px]'>
                <SelectValue placeholder='Select a faucet' />
              </SelectTrigger>
              <SelectContent>
                {faucet_type.map(faucet => (
                  <SelectItem key={faucet.id} value={faucet.id.toString()}>
                    {faucet.name} - ${faucet.retail_price}
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
          <Button onClick={handleAddFaucet} disabled={!selectedFaucet}>
            Add Faucet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
