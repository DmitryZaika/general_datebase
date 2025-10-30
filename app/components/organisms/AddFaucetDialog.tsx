import { useMemo, useState } from 'react'
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

  // Get already selected faucet type IDs from all rooms to filter them out
  const selectedFaucetTypeIds = useMemo(() => {
    const allRooms = form.getValues('rooms') || []
    const allSelectedFaucets = allRooms.flatMap(room => room.faucet_type || [])
    return new Set(allSelectedFaucets.map(faucet => faucet.type_id))
  }, [form.watch('rooms')])

  // Filter out already selected faucets
  const availableFaucets = useMemo(() => {
    return faucet_type.filter(faucet => !selectedFaucetTypeIds.has(faucet.id))
  }, [faucet_type, selectedFaucetTypeIds])

  const handleAddFaucet = () => {
    if (!selectedFaucet) {
      return
    }
    const currentFaucets = form.getValues(`rooms.${roomIndex}.faucet_type`) || []
    form.setValue(`rooms.${roomIndex}.faucet_type`, [
      ...currentFaucets,
      {
        type_id: selectedFaucet,
        price: faucet_type.find(f => f.id === selectedFaucet)?.retail_price || 0,
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
          {availableFaucets.length === 0 ? (
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
                {availableFaucets.map(faucet => (
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
