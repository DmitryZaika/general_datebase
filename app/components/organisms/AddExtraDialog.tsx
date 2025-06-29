import { CUSTOMER_ITEMS } from '~/utils/constants'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { useState, useEffect } from 'react'

export const AddExtraDialog = ({
  show,
  setShow,
  currentItems,
  onSave,
}: {
  show: boolean
  setShow: (show: boolean) => void
  currentItems: string[]
  onSave: (items: string[]) => void
}) => {
  const [dialogSelection, setDialogSelection] = useState<string[]>([])

  useEffect(() => {
    if (show) {
      setDialogSelection(currentItems)
    }
  }, [show, currentItems])

  const handleItemToggle = (item: string) => {
    setDialogSelection(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item],
    )
  }

  const handleSave = () => {
    onSave(dialogSelection)
    setShow(false)
  }

  const availableItems = Object.keys(CUSTOMER_ITEMS)

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className='sm:max-w-[400px]'>
        <DialogHeader>
          <DialogTitle>Add Extra Items</DialogTitle>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          {availableItems.map(item => (
            <label
              key={item}
              className='flex items-center justify-between p-2 rounded-md hover:bg-gray-50 cursor-pointer'
            >
              <span className='text-sm font-medium capitalize'>
                {item.replaceAll('_', ' ')}
              </span>
              <input
                type='checkbox'
                checked={dialogSelection.includes(item)}
                onChange={() => handleItemToggle(item)}
                className='h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500'
              />
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save ({dialogSelection.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
