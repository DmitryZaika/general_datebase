import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import { Form, Link, Outlet } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { CustomerSearch } from '~/components/molecules/CustomerSearch'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { InputItem } from './molecules/InputItem'
import { LoadingButton } from './molecules/LoadingButton'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { FormField } from './ui/form'

export function DealsForm({
  initial,
  open,
  onOpenChange,
  hiddenFields = {},
  companyId,
  dealId,
  user_id,
}: {
  initial?: Partial<DealsDialogSchema>
  open: boolean
  onOpenChange: (open: boolean) => void
  hiddenFields?: Record<string, string | number | boolean>
  companyId: number
  dealId?: number
  user_id: number
}) {
  const form = useForm<DealsDialogSchema>({
    resolver: zodResolver(dealsSchema),
    defaultValues: { ...hiddenFields, ...(initial || {}), user_id },
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dealId ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form id='dealForm' method='post' onSubmit={fullSubmit}>
            <AuthenticityTokenInput />

            {Object.entries(hiddenFields).map(([k, v]) => (
              <input type='hidden' name={k} value={String(v)} key={k} />
            ))}
            <CustomerSearch form={form} companyId={companyId} source='user-input' />
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
                  inputAutoFocus={!!dealId}
                  name={'Description'}
                  placeholder={'Description of the deal'}
                  field={field}
                />
              )}
            />

            <DialogFooter>
              <div className='flex justify-between gap-2 w-full'>
                {dealId && (
                  <div className='flex justify-start'>
                    <Link to={`delete`} relative='path'>
                      <Button variant='destructive' type='button' className='mb-4'>
                        Delete
                      </Button>
                    </Link>
                  </div>
                )}
                <div className='flex justify-end w-full'>
                  <LoadingButton loading={false} type='submit'>
                    {dealId ? 'Save' : 'Create'}
                  </LoadingButton>
                </div>
              </div>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
      <Outlet />
    </Dialog>
  )
}

export default DealsForm
