import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form'
import { Form, Link, Outlet, useSearchParams } from 'react-router'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

function MainComponent({
  form,
  companyId,
  dealId,
}: {
  form: UseFormReturn<DealsDialogSchema>
  companyId: number
  dealId?: number
}) {
  return (
    <>
      <CustomerSearch
        onCustomerChange={value => form.setValue('customer_id', value ?? null)}
        companyId={companyId}
        source='user-input'
        selectedCustomer={form.watch('customer_id') ?? undefined}
        error={form.formState.errors.customer_id?.message}
        setError={error =>
          form.setError('customer_id', { message: error ?? undefined })
        }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'main'

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

            <Tabs
              defaultValue='main'
              className='mt-2'
              value={tab}
              onValueChange={value => setSearchParams({ tab: value })}
            >
              <TabsList className='grid w-full grid-cols-4'>
                <TabsTrigger value='main'>Main Info</TabsTrigger>
                <TabsTrigger value='images'>Images</TabsTrigger>
                <TabsTrigger value='documents'>Documents</TabsTrigger>
                <TabsTrigger value='project'>Project Info</TabsTrigger>
              </TabsList>

              <TabsContent value='main' className='space-y-2'>
                <MainComponent form={form} companyId={companyId} dealId={dealId} />
              </TabsContent>

              <TabsContent value='images'>
                <div className='text-sm text-gray-500'>
                  Upload images will be available after creating the deal.
                </div>
              </TabsContent>

              <TabsContent value='documents'>
                <div className='text-sm text-gray-500'>
                  Attach documents will be available after creating the deal.
                </div>
              </TabsContent>

              <TabsContent value='project'>
                <div className='text-sm text-gray-500'>Project info coming soon.</div>
              </TabsContent>
            </Tabs>

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
