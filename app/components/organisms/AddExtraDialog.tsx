import { Plus } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import type { TCustomerSchema } from '~/schemas/sales'
import { CUSTOMER_ITEMS } from '~/utils/constants'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

export const AddExtraDialog = ({
  form,
  index,
}: {
  form: UseFormReturn<TCustomerSchema>
  index: number
}) => {
  const availableItems = Object.keys(CUSTOMER_ITEMS)
  const selectedItems = Object.keys(form.getValues(`rooms.${index}.extras`))

  const handleItemToggle = (item: string) => {
    const current = form.getValues(`rooms.${index}.extras`)
    if (selectedItems.includes(item)) {
      delete current[item]
    } else {
      current[item] = {}
    }
    form.setValue(`rooms.${index}.extras`, current)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type='button' size='sm'>
          <Plus className='h-3 w-3' /> Add Extra Item to Room
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[400px]'>
        <DialogHeader>
          <DialogTitle>Add Extra Items</DialogTitle>
          <DialogDescription>Manage optional items for this room</DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          {availableItems
            .filter(item => item !== 'edge_price')
            .map(item => (
              <label
                key={item}
                className='flex items-center justify-between p-2 rounded-md hover:bg-gray-50 cursor-pointer'
              >
                <span className='text-sm font-medium capitalize'>
                  {item.replaceAll('_', ' ')}
                </span>
                <input
                  type='checkbox'
                  checked={selectedItems.includes(item)}
                  onChange={() => handleItemToggle(item)}
                  className='h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500'
                />
              </label>
            ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
