import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form'
import { Form, Link, useLocation } from 'react-router'
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
}: {
  form: UseFormReturn<DealsDialogSchema>
  companyId: number
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
        name='title'
        render={({ field }) => (
          <InputItem name={'Title'} placeholder={'Title of the deal'} field={field} />
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
  const location = useLocation()
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
        />

        <DialogFooter>
          <div className='flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2'>
            {dealId ? (
              <div className='flex flex-wrap items-center gap-2'>
                <Link to={`../images${location.search}`} relative='path'>
                  <Button variant='outline' type='button'>
                    Images
                  </Button>
                </Link>
                <Link to={`../documents${location.search}`} relative='path'>
                  <Button variant='outline' type='button'>
                    Documents
                  </Button>
                </Link>
                <Link to={`../delete${location.search}`} relative='path'>
                  <Button variant='destructive' type='button'>
                    Delete
                  </Button>
                </Link>
              </div>
            ) : null}
            <div className='flex w-full justify-end sm:w-auto sm:ml-auto'>
              <LoadingButton
                loading={form.formState.isSubmitting}
                type='submit'
                className='w-full sm:w-auto'
              >
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
