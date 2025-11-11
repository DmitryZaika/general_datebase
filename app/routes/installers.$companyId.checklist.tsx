import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  Form,
  redirect,
  useLoaderData,
  type LoaderFunctionArgs
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SignatureInput, type SigRef } from '~/components/molecules/SignatureInput'
import { AddressInput } from '~/components/organisms/AddressInput'
import { Checkbox } from '~/components/ui/checkbox'
import { FormField, FormProvider } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { ChecklistFormData, checklistResolver } from '~/schemas/checklist'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'


// Static checklist labels mapped to form keys (defined after FormData type)
const checklistItems: Array<[keyof ChecklistFormData, string]> = [
  ['material_correct', 'Material is correct'],
  ['seams_satisfaction', 'Seams meet my satisfaction'],
  ['appliances_fit', 'Appliances fit properly'],
  ['backsplashes_correct', 'Backsplashes placed correctly'],
  ['edges_correct', 'Edges and corners are correct'],
  ['holes_drilled', 'Holes for fixtures are drilled'],
  ['cleanup_completed', 'Clean up completed'],
]

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    const paramCompanyId = Number(params.companyId)
    if (!Number.isFinite(paramCompanyId) || paramCompanyId <= 0) {
      return redirect(`/login?error=invalid_company_id`)
    }
    if (paramCompanyId !== user.company_id) {
      return redirect(`/installers/${user.company_id}/checklist`)
    }
    return { user, companyId: user.company_id }
  } catch (_error) {
    return redirect(`/login?error=${_error}`)
  }
}

const submitChecklist = async (formData: ChecklistFormData, companyId: number) => {
  const response = await fetch(`/api/checklist/${companyId}`, {
    method: 'POST',
    body: JSON.stringify(formData),
  })
  return response.json()
}

const defaultValues: ChecklistFormData = {
    customer_name: '',
    customer_id: null,
    installation_address: '',
    material_correct: '',
    seams_satisfaction: '',
    appliances_fit: '',
    backsplashes_correct: '',
    edges_correct: '',
    holes_drilled: '',
    cleanup_completed: '',
    comments: '',
    signature: '',
  }

export default function AdminChecklists() {
  const sigRef = useRef<SigRef>(null)
  const { companyId } = useLoaderData<{ companyId: number }>()
  const form = useForm<ChecklistFormData>({  
    resolver: checklistResolver,
    defaultValues
  })
  const localStorageLockedRef = useRef<boolean>(false)


  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ChecklistFormData) => {
      await submitChecklist(data, companyId)
    },
    onSuccess: () => {
      localStorageLockedRef.current = true
      localStorage.setItem('checklistData', JSON.stringify(defaultValues))
      form.reset(defaultValues)
      sigRef.current?.clear()
      toastData('Success', 'Checklist saved to database')
      },
  })

  useEffect(() => {
    const savedData = localStorage.getItem('checklistData')
    if (savedData) {
      form.reset(JSON.parse(savedData))
    }
  }, [])


  const watchValues = form.watch()

  useEffect(() => {
    const asJson = JSON.stringify(watchValues)
    const defaultJson = JSON.stringify(defaultValues)
    if (asJson !== defaultJson && !localStorageLockedRef.current) {
      localStorage.setItem('checklistData', asJson)
    } else if (localStorageLockedRef.current) {
      localStorageLockedRef.current = false
    }
  }, [watchValues])

  const handleSubmit = (data: ChecklistFormData) => {
    mutate(data)
  }


  return (
    <div className='flex justify-center py-10'>
      <div className='w-full max-w-xl border rounded-md bg-white p-8 shadow-sm'>
        <img
          src={companyId === 1 ? 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo.png.png' : 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/photo_2025-11-03_17-53-06.jpg'}
          alt='Logo'
          className='mx-auto mb-4 h-46 object-contain'
        />
        <h1 className='mb-6 text-center text-2xl font-semibold'>
          Post-installation check list
        </h1>
        <FormProvider {...form}>
          <Form method='post' onSubmit={form.handleSubmit(handleSubmit)} >
          <AuthenticityTokenInput />
            {/* <CustomerSearch
              onCustomerChange={value => form.setValue('customer_id', value ?? null)}
              selectedCustomer={form.watch('customer_id') ?? undefined}
              companyId={companyId}
              source='check-list'
              error={form.formState.errors.customer_id?.message}
              setError={error =>
                form.setError('customer_id', { message: error ?? undefined })
              }
            /> */}
            <FormField
              control={form.control}
              name='customer_name'
              render={({ field }) => (
                <InputItem name='Customer Name' placeholder='Customer' field={field} />
              )}
            />
            <AddressInput form={form} field='installation_address' type='project' />
            <div className='my-4 space-y-2'>
              <p className='font-medium'>Check all that apply</p>
              {checklistItems.map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <div className='flex items-center justify-between space-x-2'>
                      <Checkbox
                        className='cursor-pointer'
                        checked={!!field.value}
                        onCheckedChange={checked => field.onChange(checked ? 'on' : '')}
                        id={name}
                      />
                      <label htmlFor={name} className='text-sm cursor-pointer flex-1'>
                        {label}
                      </label>
                    </div>
                  )}
                />
              ))}
            </div>

            {/* Comments */}
            <FormField
              control={form.control}
              name='comments'
              render={({ field }) => (
                <Textarea placeholder='Comments' rows={4} {...field} />
              )}
            />

            {/* Signature canvas */}
            <FormField
              control={form.control}
              name='signature'
              render={({ field }) => <SignatureInput field={field} sigRef={sigRef} />}
            />

            <p className='my-4 text-xs text-gray-600'>
              By signing below I affirm that this installation is completed to my
              satisfaction, and I accept the countertops installed by Granite Depot.
            </p>

            <div className='mt-6 flex justify-center'>
              <LoadingButton loading={isPending}>Submit</LoadingButton>
            </div>
          </Form>
      
        </FormProvider>
      </div>
    </div>
  )
}