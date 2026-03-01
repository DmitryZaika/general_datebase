import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormLabel, FormProvider } from '~/components/ui/form'
import { useToast } from '~/hooks/use-toast'
import {
  type CustomerDialogSchema,
  createCustomerMutation,
  customerDialogSchema,
  sourceEnum,
  updateCustomerMutation,
} from '~/schemas/customers'
import { EmailInput } from '../molecules/EmailInput'
import { PhoneInput } from '../molecules/PhoneInput'
import { SelectInput } from '../molecules/SelectItem'
import { AddressInput } from '../organisms/AddressInput'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'

const resolver = zodResolver(customerDialogSchema)

interface CustomerFormProps {
  setCreatedDealId?: (id: number) => void
  handleChange: (open: boolean) => void
  onSuccess: (value: number, name: string) => void
  companyId: number
  customerId?: number
  source?: (typeof sourceEnum)[number]
  initialName?: string
  oldData?: CustomerDialogSchema & { sales_rep_name?: string }
}

type SourceOptions = {
  key: (typeof sourceEnum)[number]
  value: string
}

function getSourceOptions(
  current: (typeof sourceEnum)[number] | undefined,
): SourceOptions[] {
  const baseOptions: SourceOptions[] = sourceEnum
    .filter(s => s !== 'check-list')
    .map(s => ({
      key: s,
      value: s.charAt(0).toUpperCase() + s.slice(1),
    }))
  if (!current) return baseOptions
  const hasCurrent = baseOptions.some(o => o.key === current)
  if (!hasCurrent) return baseOptions
  if (baseOptions.filter(o => o.key === current).length !== 0) return baseOptions
  baseOptions.push({
    key: current,
    value: current.charAt(0).toUpperCase() + current.slice(1),
  })
  return baseOptions
}

export function CustomerForm({
  setCreatedDealId,
  handleChange,
  onSuccess,
  companyId,
  customerId,
  source,
  initialName,
  oldData,
}: CustomerFormProps) {
  const { toast: toastFn } = useToast()
  const successToast = (message: string) =>
    toastFn({ title: 'Success', description: message, variant: 'success' })

  const handleSuccess = (id: number, dealId?: number) => {
    successToast(
      customerId ? 'Customer updated successfully' : 'Customer added successfully',
    )
    onSuccess(id, form.getValues('name'))

    if (setCreatedDealId && dealId) {
      setCreatedDealId(dealId)
    }
  }

  const mutateObject = customerId
    ? updateCustomerMutation(toastFn, handleSuccess)
    : createCustomerMutation(toastFn, handleSuccess)
  const { mutate, isPending } = useMutation(mutateObject)

  const { data: reps = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const res = await fetch('/api/sales-reps')
      const json = await res.json()
      return json.users ?? []
    },
  })

  const salesRepOptions = useMemo(() => {
    const base = reps.map(r => ({ key: String(r.id), value: r.name }))
    const assignedId =
      oldData?.sales_rep && oldData.sales_rep !== '' ? Number(oldData.sales_rep) : null
    const assignedName = oldData?.sales_rep_name
    if (assignedId != null && assignedName && !reps.some(r => r.id === assignedId)) {
      return [{ key: String(assignedId), value: assignedName }, ...base]
    }
    return base
  }, [reps, oldData?.sales_rep, oldData?.sales_rep_name])

  const form = useForm({
    resolver,
    defaultValues: oldData ?? {
      name: initialName || '',
      email: '',
      phone: '',
      phone_2: '',
      address: '',
      source,
      your_message: '',
      sales_rep: '',
    },
  })

  const [dupOpen, setDupOpen] = useState(false)
  const [dupInfo, setDupInfo] = useState<{
    name: string
    sales_rep_name: string | null
  } | null>(null)

  const phoneValue = form.watch('phone')
  const emailValue = form.watch('email')
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (phoneValue && phoneValue.trim() !== '') params.set('phone', phoneValue.trim())
    if (emailValue && emailValue.trim() !== '') params.set('email', emailValue.trim())
    return params.toString()
  }, [phoneValue, emailValue])

  const onSubmit = async (data: CustomerDialogSchema) => {
    if (!customerId && queryString) {
      const res = await fetch(`/api/customers/duplicate-check?${queryString}`)
      const js = await res.json()
      const match =
        Array.isArray(js.matches) && js.matches.length > 0 ? js.matches[0] : null
      if (match) {
        setDupInfo({ name: match.name, sales_rep_name: match.sales_rep_name || null })
        setDupOpen(true)
        return
      }
    }
    const salesRep =
      data.sales_rep === '' || data.sales_rep == null ? null : Number(data.sales_rep)
    mutate({
      ...data,
      company_id: companyId,
      id: customerId || 0,
      sales_rep: salesRep,
    })
  }

  const dialogTitle = customerId ? 'Edit Customer' : 'Add Customer'
  const sourceOptions = getSourceOptions(form.watch('source'))

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <Dialog open={dupOpen} onOpenChange={setDupOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <div className='font-bold min-h-10'>
                  <p className='mb-3'> Customer {dupInfo?.name} already exists </p>
                  <p> Sales rep: {dupInfo?.sales_rep_name || 'Unassigned'} </p>
                </div>
              </DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <FormProvider {...form}>
          <form
            id='customerForm'
            onSubmit={e => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit(onSubmit)()
            }}
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem
                  name={'Name*'}
                  placeholder={'Name of the customer'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => <EmailInput field={field} />}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => <PhoneInput field={field} inputName='Phone 1' />}
            />
            <FormField
              control={form.control}
              name='phone_2'
              render={({ field }) => <PhoneInput field={field} inputName='Phone 2' />}
            />
            <AddressInput form={form} field='address' type='billing' />
            <FormField
              control={form.control}
              name='source'
              render={({ field }) => (
                <SelectInput field={field} options={sourceOptions} name='Source' />
              )}
            />
            <FormField
              control={form.control}
              name='sales_rep'
              render={({ field }) => (
                <SelectInput
                  field={field}
                  options={salesRepOptions}
                  name='Sales Rep'
                  placeholder='Select'
                />
              )}
            />
            <div className='flex items-center space-x-2 my-2'>
              <FormField
                control={form.control}
                name='builder'
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={value => {
                      field.onChange(value)
                      if (!value) {
                        form.setValue('company_name', '')
                      }
                    }}
                    id='builder_switch'
                    label='Company'
                    className=''
                  />
                )}
              />
            </div>
            {form.watch('builder') && (
              <InputItem
                name='Company Name'
                placeholder='Company Name'
                field={form.register('company_name')}
              />
            )}
            <FormLabel>Notes</FormLabel>
            <FormField
              control={form.control}
              name='your_message'
              render={({ field }) => (
                <Textarea
                  {...field}
                  value={(field.value as string) ?? ''}
                  name='Notes'
                />
              )}
            />

            <DialogFooter>
              <LoadingButton loading={isPending}>Submit</LoadingButton>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
