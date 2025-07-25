import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Form } from 'react-router'
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
import { type CustomerDialogSchema, customerDialogSchema } from '~/schemas/customers'
import { EmailInput } from '../molecules/EmailInput'
import { AddressInput } from '../organisms/AddressInput'

const resolver = zodResolver(customerDialogSchema)

interface CustomerFormProps {
  handleChange: (open: boolean) => void
  onSubmit: (data: CustomerDialogSchema) => void
  isLoading: boolean
}

export function CustomerForm({ handleChange, onSubmit, isLoading }: CustomerFormProps) {
  const form = useForm<CustomerDialogSchema>({
    resolver,
  })
  console.log(form.formState.errors)
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='customerForm' method='post' onSubmit={form.handleSubmit(onSubmit)}>
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
              <LoadingButton type='submit' loading={isLoading}>
                Save changes
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
