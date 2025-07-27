import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
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
  updateCustomerMutation,
} from '~/schemas/customers'
import { EmailInput } from '../molecules/EmailInput'
import { AddressInput } from '../organisms/AddressInput'

const resolver = zodResolver(customerDialogSchema)

interface CustomerFormProps {
  handleChange: (open: boolean) => void
  onSuccess: (value: number, name: string) => void
  companyId: number
  customerId?: number
}

const getCustomerInfo = async (customerId: number) => {
  const response = await fetch(`/api/customers/${customerId}`)
  const data = await response.json()
  return {
    name: data.customer.name,
    email: data.customer.email,
    phone: data.customer.phone,
    address: data.customer.address,
  }
}

export function CustomerForm({
  handleChange,
  onSuccess,
  companyId,
  customerId,
}: CustomerFormProps) {
  const toast = useToast()
  const mutateObject = customerId
    ? updateCustomerMutation(toast, value => onSuccess(value, form.getValues('name')))
    : createCustomerMutation(toast, value => onSuccess(value, form.getValues('name')))
  const mutation = useMutation(mutateObject)
  const { data, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomerInfo(customerId || 0),
    enabled: !!customerId,
  })

  const form = useForm<CustomerDialogSchema>({
    resolver,
  })

  useEffect(() => {
    if (data) {
      form.reset(data)
    }
  }, [data])

  const onSubmit = (data: CustomerDialogSchema) => {
    mutation.mutate({ ...data, company_id: companyId, id: customerId || 0 })
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLoading ? 'Loading...' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
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
                    name={'Name'}
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
                render={({ field }) => (
                  <InputItem
                    name={'Phone'}
                    placeholder={"Customer's phone number"}
                    field={field}
                  />
                )}
              />

              <AddressInput form={form} field='address' />

              <DialogFooter>
                <LoadingButton loading={mutation.isPending}>Save changes</LoadingButton>
              </DialogFooter>
            </form>
          </FormProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}
