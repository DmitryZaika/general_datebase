import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
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
import { FormField, FormProvider } from '~/components/ui/form'
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

const resolver = zodResolver(customerDialogSchema)

interface CustomerFormProps {
  handleChange: (open: boolean) => void
  onSuccess: (value: number, name: string) => void
  companyId: number
  customerId?: number
  source?: (typeof sourceEnum)[number]
}

const getCustomerInfo = async (customerId: number) => {
  const response = await fetch(`/api/customers/${customerId}`)
  const data = await response.json()
  return {
    name: data.customer.name,
    email: data.customer.email ?? '',
    phone: data.customer.phone,
    address: data.customer.address ?? '',
    company_name: data.customer.company_name,
    source: data.customer.source,
  }
}

export function CustomerForm({
  handleChange,
  onSuccess,
  companyId,
  customerId,
  source,
}: CustomerFormProps) {
  const { toast: toastFn } = useToast()
  const successToast = (message: string) =>
    toastFn({ title: 'Success', description: message, variant: 'success' })

  const handleSuccess = (id: number) => {
    successToast(
      customerId ? 'Customer updated successfully' : 'Customer added successfully',
    )
    onSuccess(id, form.getValues('name'))
  }

  const mutateObject = customerId
    ? updateCustomerMutation(toastFn, handleSuccess)
    : createCustomerMutation(toastFn, handleSuccess)
  const { mutate, isPending } = useMutation(mutateObject)
  const { data, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomerInfo(customerId || 0),
    enabled: !!customerId,
  })

  const form = useForm<CustomerDialogSchema>({
    resolver,
    defaultValues: {
      email: '',
      address: '',
      source,
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
  useEffect(() => {
    if (data) {
      form.reset({
        ...data,
        builder: Boolean(data.company_name && data.company_name.trim() !== ''),
        source: data.source ?? source,
      })
    }
  }, [data])

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
    mutate({ ...data, company_id: companyId, id: customerId || 0 })
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLoading ? 'Loading...' : 'Add Customer'}</DialogTitle>
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
        {isLoading ? (
          <div>Loading...</div>
        ) : (
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
                render={({ field }) => <PhoneInput field={field} />}
              />

              <AddressInput form={form} field='address' type='billing' />
              <FormField
                control={form.control}
                name='source'
                render={({ field }) => {
                  const baseOptions = sourceEnum
                    .filter(s => s !== 'user-input' && s !== 'check-list')
                    .map(s => ({
                      key: s,
                      value: s.charAt(0).toUpperCase() + s.slice(1),
                    }))
                  const current = form.getValues('source')
                  const hasCurrent = baseOptions.some(o => o.key === current)
                  const options = hasCurrent
                    ? baseOptions
                    : current
                      ? [
                          {
                            key: current,
                            value: current.charAt(0).toUpperCase() + current.slice(1),
                          },
                          ...baseOptions,
                        ]
                      : baseOptions
                  return <SelectInput field={field} options={options} name='Source' />
                }}
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
                      label='Builder'
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
              <DialogFooter>
                <LoadingButton loading={isPending}>Submit</LoadingButton>
              </DialogFooter>
            </form>
          </FormProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}
