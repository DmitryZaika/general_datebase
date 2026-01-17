import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form'
import { Form, Link } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { CustomerSearch } from '~/components/molecules/CustomerSearch'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { InputItem } from './molecules/InputItem'
import { LoadingButton } from './molecules/LoadingButton'
import { Button } from './ui/button'
import { DialogFooter } from './ui/dialog'
import { FormField } from './ui/form'

function MainComponent({
  setCreatedDealId,
  form,
  companyId,
  dealId,
}: {
  form: UseFormReturn<DealsDialogSchema>
  companyId: number
  dealId?: number
  setCreatedDealId: (id: number) => void
}) {
  return (
    <>
      <CustomerSearch
        onCustomerChange={value =>
          form.setValue('customer_id', value ?? (undefined as unknown as number))
        }
        companyId={companyId}
        source={'other'}
        selectedCustomer={form.watch('customer_id') ?? undefined}
        error={form.formState.errors.customer_id?.message}
        setError={error =>
          form.setError('customer_id', { message: error ?? undefined })
        }
        setCreatedDealId={setCreatedDealId}
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
            inputAutoFocus={!!dealId && dealId !== undefined}
            name={'Description'}
            placeholder={'Description of the deal'}
            field={field}
          />
        )}
      />
    </>
  )
}

export function DealsForm({
  initial,
  hiddenFields = {},
  companyId,
  dealId,
  user_id,
}: {
  initial?: Partial<DealsDialogSchema>
  hiddenFields?: Record<string, string | number | boolean>
  companyId: number
  dealId?: number
  user_id: number
}) {
  const form = useForm({
    resolver: zodResolver(dealsSchema),
    defaultValues: { ...hiddenFields, ...(initial || {}), user_id },
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <FormProvider {...form}>
      <Form id='dealForm' method='post' onSubmit={fullSubmit}>
        <AuthenticityTokenInput />

        {Object.entries(hiddenFields).map(([k, v]) => (
          <input type='hidden' name={k} value={String(v)} key={k} />
        ))}

        <MainComponent
          setCreatedDealId={(deal_id: number) => form.setValue('deal_id', deal_id)}
          form={form as UseFormReturn<DealsDialogSchema>}
          companyId={companyId}
          dealId={dealId}
        />

        <DialogFooter>
          <div className='flex justify-between gap-2 w-full'>
            {dealId && (
              <div className='flex justify-start'>
                <Link to={`../delete`} relative='path'>
                  <Button variant='destructive' type='button' className='mb-4'>
                    Delete
                  </Button>
                </Link>
              </div>
            )}
            <div className='flex justify-end w-full'>
              <LoadingButton loading={form.formState.isSubmitting} type='submit'>
                {dealId ? 'Save' : 'Create'}
              </LoadingButton>
            </div>
          </div>
        </DialogFooter>
      </Form>
    </FormProvider>
  )
}

export default DealsForm
