import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import { Form } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { InputItem } from './molecules/InputItem'
import { LoadingButton } from './molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { FormField } from './ui/form'

export default function DealsForm({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<DealsDialogSchema>({
    resolver: zodResolver(dealsSchema),
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form id='dealForm' method='post' onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
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
              name='amount'
              render={({ field }) => (
                <InputItem
                  name={'Amount'}
                  placeholder={'Amoount of the deal'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <InputItem
                  name={'Description'}
                  placeholder={'Description of the deal'}
                  field={field}
                />
              )}
            />

            <DialogFooter>
              <LoadingButton loading={false} type='submit'>
                Submit
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
