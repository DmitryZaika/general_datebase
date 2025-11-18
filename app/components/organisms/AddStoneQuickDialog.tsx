import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Info } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { quickAddStoneSchema, type TQuickAddStoneSchema } from '~/schemas/stones'
import type { StoneSlim } from '~/types'
import { STONE_TYPES } from '~/utils/constants'
import { InputItem } from '../molecules/InputItem'
import { LoadingButton } from '../molecules/LoadingButton'
import { SelectInput } from '../molecules/SelectItem'
import { SwitchItem } from '../molecules/SwitchItem'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { FormField, FormProvider } from '../ui/form'

interface AddStoneQuickDialogProps {
  show: boolean
  setShow: (show: boolean) => void
  companyId: number
  onStoneCreated: (stone: StoneSlim, slabId?: number) => void
}

export function AddStoneQuickDialog({
  show,
  setShow,
  companyId,
  onStoneCreated,
}: AddStoneQuickDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Memoize default values to prevent unnecessary re-renders
  const defaultValues = useMemo(
    () => ({
      name: '',
      retail_price: undefined as number | undefined,
      length: undefined as number | undefined,
      width: undefined as number | undefined,
      type: 'granite' as const,
      leftover: true, // Default to true - quick add is typically for leftover stones
      company_id: companyId,
    }),
    [companyId],
  )

  const form = useForm<TQuickAddStoneSchema>({
    resolver: zodResolver(quickAddStoneSchema),
    defaultValues,
  })

  const { control, watch, reset, handleSubmit: formHandleSubmit } = form
  const leftoverValue = watch('leftover')

  const resetForm = useCallback(() => {
    reset(defaultValues)
    setError(null)
  }, [reset, defaultValues])

  const handleSubmit = useCallback(async (data: TQuickAddStoneSchema) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/stones/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, company_id: companyId }),
      })

      if (!response.ok) {
        const { error: errorMessage } = await response.json()
        throw new Error(errorMessage || 'Failed to create stone')
      }

      const { stone, slab } = await response.json()
      const { id, name, type, retail_price } = stone

      // Invalidate all stone-related queries to refresh the search dropdown
      await queryClient.invalidateQueries({ queryKey: ['availableStones'] })

      onStoneCreated({ id, name, type, retail_price }, slab?.id)

      // Close dialog (handleOpenChange will reset form automatically)
      setShow(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stone')
    } finally {
      setIsSubmitting(false)
    }
  }, [companyId, queryClient, onStoneCreated, setShow])

  const handleCancel = useCallback(() => {
    resetForm()
    setShow(false)
  }, [resetForm, setShow])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetForm()
      }
      setShow(open)
    },
    [resetForm, setShow],
  )

  return (
    <Dialog open={show} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[500px] overflow-y-auto max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>Add New Color</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={e => {
              e.preventDefault()
              e.stopPropagation()
              formHandleSubmit(handleSubmit)()
            }}
            className='space-y-4'
          >
            {error && (
              <div className='flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-800'>
                <AlertCircle className='h-4 w-4 flex-shrink-0' />
                <p className='text-sm'>{error}</p>
              </div>
            )}

            <FormField
              control={control}
              name='name'
              render={({ field }) => (
                <InputItem
                  name='Name*'
                  placeholder='Enter stone name...'
                  field={field}
                  inputAutoFocus={true}
                />
              )}
            />

            <FormField
              control={control}
              name='retail_price'
              render={({ field }) => (
                <InputItem
                  name='Retail Price*'
                  placeholder='Enter price per sqft'
                  field={field}
                  type='number'
                />
              )}
            />

            <div className='flex gap-2'>
              <FormField
                control={control}
                name='length'
                render={({ field }) => (
                  <InputItem
                    name='Length*'
                    placeholder='Length'
                    field={field}
                    type='number'
                  />
                )}
              />
              <FormField
                control={control}
                name='width'
                render={({ field }) => (
                  <InputItem
                    name='Width*'
                    placeholder='Width'
                    field={field}
                    type='number'
                  />
                )}
              />
            </div>

            <FormField
              control={control}
              name='type'
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder='Select stone type'
                  name='Type'
                  options={STONE_TYPES.map(type => ({
                    key: type,
                    value: type.charAt(0).toUpperCase() + type.slice(1),
                  }))}
                />
              )}
            />

            <FormField
              control={control}
              name='leftover'
              render={({ field }) => (
                <SwitchItem field={field} name='Leftover' />
              )}
            />

            {leftoverValue && (
              <div className='flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800'>
                <Info className='h-4 w-4 flex-shrink-0 mt-0.5' />
                <div className='text-sm'>
                  <p className='font-medium mb-1'>Leftover Stone</p>
                  <p>
                    A slab with a unique bundle number (format: LO-YYYYMMDD-XXXX) will be
                    automatically created using the provided dimensions.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <LoadingButton type='submit' loading={isSubmitting}>
                Add Stone
              </LoadingButton>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
