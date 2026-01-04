import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { CustomerSearch } from '~/components/molecules/CustomerSearch'
import { EmailInput } from '~/components/molecules/EmailInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SignatureInput, type SigRef } from '~/components/molecules/SignatureInput'
import { AddressInput } from '~/components/organisms/AddressInput'
import { Checkbox } from '~/components/ui/checkbox'
import { FormField, FormProvider } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { companyIdToUrl } from '~/constants/logos'
import { useToast } from '~/hooks/use-toast'
import {
  isNetworkError,
  submitChecklistAPI,
  useChecklistQueue,
} from '~/hooks/useChecklistQueue'
import { type ChecklistFormData, checklistResolver } from '~/schemas/checklist'
import { getEmployeeUser } from '~/utils/session.server'

type CustomerDetails = { name?: string; address?: string | null; email?: string | null }

async function fetchCustomerDetails(customerId: number): Promise<CustomerDetails | null> {
  const res = await fetch(`/api/customers/${customerId}`)
  if (!res.ok) return null
  const data: { customer?: CustomerDetails } = await res.json()
  return data.customer ?? null
}

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

    return { user, companyId: user.company_id as 1 | 3 | 4 }
  } catch (_error) {
    return redirect(`/login?error=${_error}`)
  }
}

const defaultValues: ChecklistFormData = {
  customer_name: '',
  customer_id: null,
  email: '',
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
  const { companyId } = useLoaderData<typeof loader>()
  const form = useForm({
    resolver: checklistResolver,
    defaultValues,
  })
  const selectedCustomerId = form.watch('customer_id')
  const localStorageLockedRef = useRef<boolean>(false)
  const { toast } = useToast()

  const resetForm = useCallback(() => {
    localStorageLockedRef.current = true
    localStorage.setItem('checklistData', JSON.stringify(defaultValues))
    form.reset(defaultValues)
    sigRef.current?.clear()
  }, [form])

  const {
    isOnline,
    pendingCount,
    isProcessing,
    hasPendingSubmissions,
    pendingSubmissions,
    addSubmissionToQueue,
    processQueue,
    deleteSubmission,
  } = useChecklistQueue({
    companyId,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Pending checklist has been sent successfully!',
        variant: 'success',
      })
    },
    onError: (error) => {
      console.error('[Queue] Processing error:', error)
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ChecklistFormData) => {
      await submitChecklistAPI(data, companyId)
    },
    onSuccess: () => {
      resetForm()
      toast({
        title: 'Success',
        description: 'Checklist saved to database',
        variant: 'success',
      })
    },
    onError: async (error: Error, data: ChecklistFormData) => {
      if (isNetworkError(error)) {
        await addSubmissionToQueue(data)
        resetForm()
        toast({
          title: 'Offline Mode',
          description:
            'No internet. Form saved and will be sent automatically when online.',
          variant: 'default',
          duration: 6000,
        })
      } else {
        toast({
          title: 'Error',
          description:
            error.message || 'Checklist could not be saved. Please check the form.',
          variant: 'destructive',
        })
        form.setFocus('customer_name')
      }
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

  const handleSubmit = useCallback(
    async (data: ChecklistFormData) => {
      const isCurrentlyOffline = !navigator.onLine

      if (isCurrentlyOffline) {
        try {
          await addSubmissionToQueue(data)
          resetForm()
          toast({
            title: 'Offline Mode',
            description:
              'No internet. Form saved and will be sent automatically when online.',
            variant: 'default',
            duration: 6000,
          })
        } catch (error) {
          console.error('[Checklist] Failed to add to queue:', error)
          toast({
            title: 'Error',
            description: 'Failed to save offline. Please try again.',
            variant: 'destructive',
          })
        }
        return
      }

      mutate(data)
    },
    [addSubmissionToQueue, resetForm, toast, mutate],
  )

  return (
    <div className='flex justify-center py-10'>
      <div className='w-full max-w-xl border rounded-md bg-white p-8 shadow-sm'>
        <img
          src={companyIdToUrl[companyId] ?? ''}
          alt='Logo'
          className='mx-auto mb-4 h-46 object-contain'
        />
        <h1 className='mb-6 text-center text-2xl font-semibold'>
          Post-installation check list
        </h1>

        {!isOnline && (
          <div className='mb-4 p-3 bg-orange-100 border border-orange-400 rounded-md'>
            <p className='text-sm font-medium text-orange-800'>
              ⚠️ No internet connection
            </p>
            <p className='text-xs text-orange-700 mt-1'>
              Form will be saved and sent automatically when connection is restored.
            </p>
          </div>
        )}

        {hasPendingSubmissions &&
          (() => {
            const firstSubmission = pendingSubmissions[0]
            const MAX_ATTEMPTS = 20
            const isMaxAttemptsReached = firstSubmission.attempts >= MAX_ATTEMPTS
            const isSyncing = firstSubmission.status === 'syncing'
            const isFailed = firstSubmission.status === 'failed'

            if (isMaxAttemptsReached || isFailed) {
              return (
                <div className='mb-4 p-3 bg-red-100 border border-red-400 rounded-md'>
                  <div className='flex flex-col gap-2'>
                    <p className='text-sm font-medium text-red-800'>
                      ⚠️ Failed to send checklist after {MAX_ATTEMPTS} attempts
                    </p>
                    <p className='text-xs text-red-700'>
                      There may be a problem with the server or your connection. You can
                      try again or delete this pending form to submit a new one.
                    </p>
                    <div className='flex gap-2 mt-2'>
                      {isOnline && !isProcessing && (
                        <button
                          type='button'
                          onClick={() => processQueue()}
                          className='text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors'
                        >
                          Try Again
                        </button>
                      )}
                      <button
                        type='button'
                        onClick={async () => {
                          if (
                            confirm(
                              'Are you sure you want to delete the pending form? This cannot be undone.',
                            )
                          ) {
                            await deleteSubmission(firstSubmission.id!)
                          }
                        }}
                        className='text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors'
                      >
                        Delete Pending Form
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div className='mb-4 p-3 bg-blue-100 border border-blue-400 rounded-md'>
                <div className='flex justify-between items-start gap-3'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-blue-800'>
                      {isSyncing
                        ? '🔄 Sending checklist...'
                        : `📤 ${pendingCount > 1 ? `${pendingCount} checklists are` : 'Checklist is'} waiting to be sent`}
                    </p>
                    <p className='text-xs text-blue-700 mt-1'>
                      {isSyncing
                        ? 'Please wait, sending in progress...'
                        : 'It will be sent automatically when connection is available.'}
                    </p>
                    {firstSubmission.attempts > 0 && (
                      <p className='text-xs text-blue-600 mt-1'>
                        Attempts: {firstSubmission.attempts}/{MAX_ATTEMPTS}
                      </p>
                    )}
                  </div>
                  {isOnline && !isSyncing && !isProcessing && (
                    <button
                      type='button'
                      onClick={() => processQueue()}
                      className='text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors whitespace-nowrap'
                    >
                      Try Now
                    </button>
                  )}
                  {isSyncing && (
                    <div className='text-xs text-blue-600 animate-pulse'>
                      Sending...
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

        <FormProvider {...form}>
          <form
            method='post'
            onSubmit={e => {
              e.preventDefault()
              form.handleSubmit(handleSubmit)(e)
            }}
          >
            <FormField
              control={form.control}
              name='customer_name'
              render={({ field, fieldState }) => (
                <CustomerSearch
                  onCustomerChange={async customerId => {
                    if (!customerId) {
                      form.setValue('customer_id', null, { shouldValidate: true })
                      form.setValue('installation_address', '', { shouldValidate: true })
                      form.setValue('email', '', { shouldValidate: true })
                      field.onChange('')
                      return
                    }
                    form.setValue('customer_id', customerId, { shouldValidate: true })
                    const details = await fetchCustomerDetails(customerId)
                    const name = details?.name ?? ''
                    const address = details?.address ?? ''
                    const email = details?.email ?? ''
                    field.onChange(name)
                    if (address) {
                      form.setValue('installation_address', address, { shouldValidate: true })
                    }
                    if (email) {
                      form.setValue('email', email, { shouldValidate: true })
                    }
                  }}
                  onNameInput={value => {
                    form.setValue('customer_id', null, { shouldValidate: true })
                    field.onChange(value)
                  }}
                  companyId={companyId}
                  source='check-list'
                  selectedCustomer={selectedCustomerId ?? undefined}
                  error={fieldState.error?.message}
                  setError={
                    fieldState.error?.message
                      ? error => form.setError('customer_name', { message: error ?? undefined })
                      : () => {}
                  }
                />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => <EmailInput field={field} />}
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
              <LoadingButton
                loading={isPending || isProcessing}
                disabled={isPending || isProcessing}
              >
                {isProcessing
                  ? 'Sending pending form...'
                  : isPending
                    ? 'Submitting...'
                    : 'Submit'}
              </LoadingButton>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  )
}
