import { X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useNavigation } from 'react-router'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { FormField } from '../ui/form'
import { InputItem } from './InputItem'
import { LoadingButton } from './LoadingButton'
import { MultiPartForm } from './MultiPartForm'

export function SlabList() {
  const [inputFields, setInputFields] = useState<
    {
      slab: string
      is_sold: boolean
    }[]
  >([])
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'

  const handleDelete = (index: number) => {
    const newFields = inputFields.filter((_, i) => i !== index)
    setInputFields(newFields)
  }

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px] overflow-y-auto max-h-[95vh]'>
        <DialogHeader>
          <DialogTitle>+ Add Stone</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          {inputFields.map((field, index) => (
            <div key={index} className='flex gap-2'>
              <FormField
                control={form.control}
                name={`bundle[${index}].slab`}
                render={({ field }) => (
                  <InputItem
                    formClassName='mb-0'
                    className='mb-2'
                    placeholder={`Slab number ${index + 1}`}
                    field={field}
                  />
                )}
              />

              <Button type='button' onClick={() => handleDelete(index)}>
                <X />
              </Button>
            </div>
          ))}

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  )
}
