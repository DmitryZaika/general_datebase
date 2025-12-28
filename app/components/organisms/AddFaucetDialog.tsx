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

  const allRooms = form.getValues('rooms') || []
  const allSelectedFaucets = allRooms.flatMap(room => room.faucet_type || [])

  // Count how many of each faucet type are already selected
  const selectedFaucetCounts = new Map<number, number>()
  allSelectedFaucets.forEach(faucet => {
    selectedFaucetCounts.set(
      faucet.type_id,
      (selectedFaucetCounts.get(faucet.type_id) || 0) + 1,
    )
  })

  // Calculate remaining available for each faucet type
  const faucetsWithRemaining = faucet_type
    .map(faucet => {
      const totalAvailable = Number(faucet.faucet_count) || 0
      const alreadySelected = selectedFaucetCounts.get(faucet.id) || 0
      const remaining = totalAvailable - alreadySelected

      return {
        ...faucet,
        remaining,
      }
    })
    .filter(faucet => faucet.remaining > 0) // Only show faucets with availability

  const handleAddFaucet = () => {
    if (!selectedFaucet) {
      return
    }

    const currentFaucets = form.getValues(`rooms.${roomIndex}.faucet_type`) || []

    // Add faucet to form
    form.setValue(`rooms.${roomIndex}.faucet_type`, [
      ...currentFaucets,
      {
        type_id: selectedFaucet,
        price: faucet_type.find(f => f.id === selectedFaucet)?.retail_price || 0,
      },
    ])

    setSelectedFaucet(undefined)
    setShow(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedFaucet(undefined) // Reset selection when closing
    }
    setShow(open)
  }

  return (
    <Dialog open={show} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add Faucet</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {faucetsWithRemaining.length === 0 ? (
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
                {faucetsWithRemaining.map(faucet => (
                  <SelectItem key={faucet.id} value={faucet.id.toString()}>
                    {faucet.name} - ${faucet.retail_price} (avail: {faucet.remaining})
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
