import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Info, Plus, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { quickAddStoneFormSchema } from '~/schemas/stones'
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
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type QuickAddStoneFormData = {
  name: string
  retail_price?: number
  length?: number
  width?: number
  type: (typeof STONE_TYPES)[number]
  leftover: boolean
  bundles: { value: string }[]
  company_id: number
}

interface AddStoneQuickDialogProps {
  show: boolean
  setShow: (show: boolean) => void
  companyId: number
  onStoneCreated: (stone: StoneSlim, slabIds?: number[]) => void
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

  const defaultValues = useMemo(
    () => ({
      name: '',
      retail_price: undefined as number | undefined,
      length: undefined as number | undefined,
      width: undefined as number | undefined,
      type: 'granite' as const,
      leftover: true,
      bundles: [{ value: '' }],
      company_id: companyId,
    }),
    [companyId],
  )

  const form = useForm<QuickAddStoneFormData>({
    resolver: zodResolver(quickAddStoneFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const {
    control,
    watch,
    reset,
    handleSubmit: formHandleSubmit,
    formState: { errors },
    trigger,
  } = form
  const leftoverValue = watch('leftover')

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bundles',
  })

  const handleAddBundle = useCallback(() => {
    append({ value: '' })
  }, [append])

  const handleRemoveBundle = useCallback(
    (index: number) => {
      if (fields.length > 1) {
        remove(index)
      }
    },
    [fields.length, remove],
  )

  const resetForm = useCallback(() => {
    reset(defaultValues)
    setError(null)
  }, [reset, defaultValues])

  const handleSubmit = useCallback(async (data: QuickAddStoneFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const basePayload = {
        name: data.name,
        retail_price: data.retail_price,
        length: data.length,
        width: data.width,
        type: data.type,
        company_id: companyId,
      }

      const payload = data.leftover
        ? { ...basePayload, leftover: true as const }
        : { ...basePayload, leftover: false as const, bundles: data.bundles.map(b => b.value) }

      const response = await fetch('/api/stones/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const { error: errorMessage } = await response.json()
        throw new Error(errorMessage || 'Failed to create stone')
      }

      const { stone, slabs } = await response.json()
      const { id, name, type, retail_price } = stone

      await queryClient.invalidateQueries({ queryKey: ['availableStones'] })

      const slabIds = slabs?.map((s: { id: number }) => s.id)
      onStoneCreated({ id, name, type, retail_price }, slabIds)

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
                <SwitchItem
                  field={{
                    ...field,
                    onChange: (checked: boolean) => {
                      field.onChange(checked)
                      if (checked) {
                        form.setValue('bundles', [{ value: '' }])
                      }
                    },
                  }}
                  name='Leftover'
                />
              )}
            />

            {!leftoverValue && (
              <div className='space-y-3'>
                <Label>Bundle Numbers*</Label>
                {fields.map((field, index) => (
                  <div key={field.id} className='flex gap-2'>
                    <FormField
                      control={control}
                      name={`bundles.${index}.value`}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder={`Bundle ${index + 1}`}
                          className='flex-1'
                          onChange={e => {
                            field.onChange(e)
                            trigger('bundles')
                          }}
                        />
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={() => handleRemoveBundle(index)}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                ))}
                {errors.bundles && (
                  <p className='text-sm text-red-500'>
                    {errors.bundles.message || errors.bundles.root?.message}
                  </p>
                )}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleAddBundle}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Bundle
                </Button>
              </div>
            )}

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
