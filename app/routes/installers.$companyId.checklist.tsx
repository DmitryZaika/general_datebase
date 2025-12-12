import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SignatureInput, type SigRef } from '~/components/molecules/SignatureInput'
import { AddressInput } from '~/components/organisms/AddressInput'
import { Checkbox } from '~/components/ui/checkbox'
import { FormField, FormProvider } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { gbColumbus, gbIndianapolis, gmqTops } from '~/constants/logos'
import { useToast } from '~/hooks/use-toast'
import { useChecklistQueue } from '~/hooks/useChecklistQueue'
import { type ChecklistFormData, checklistResolver } from '~/schemas/checklist'
import { getEmployeeUser } from '~/utils/session.server'

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

class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

class OfflineError extends Error {
  constructor() {
    super('Device is offline')
    this.name = 'OfflineError'
  }
}

const submitChecklist = async (formData: ChecklistFormData, companyId: number) => {
  if (!navigator.onLine) {
    throw new OfflineError()
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`/api/checklist/${companyId}`, {
      method: 'POST',
      body: JSON.stringify(formData),
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status >= 500) {
        throw new NetworkError(`Server error: ${response.status}`)
      }
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({}))

        if ('errors' in errorData) {
          throw new Error(JSON.stringify(errorData.errors))
        }
        throw new Error(`Request failed with status ${response.status}`)
      }
      throw new NetworkError(`HTTP error: ${response.status}`)
    }

    const data = await response.json()
    if ('errors' in data) {
      throw new Error(JSON.stringify(data.errors))
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)

    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch'))
    ) {
      throw new NetworkError('Connection timeout or network error')
    }

    if (error instanceof NetworkError) {
      throw error
    }

    throw error
  }
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
    defaultValues,
  })
  const localStorageLockedRef = useRef<boolean>(false)
  const { toast } = useToast()

  const {
    isOnline,
    pendingCount,
    isProcessing,
    hasPendingSubmissions,
    pendingSubmissions,
    addSubmissionToQueue,
    processQueue,
    deleteSubmission,
    clearFailedSubmissions,
  } = useChecklistQueue({
    companyId,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Pending checklist has been sent successfully!',
        variant: 'success',
      })
    },
    onError: error => {
      console.error('Queue processing error:', error)
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ChecklistFormData) => {
      if (!navigator.onLine) {
        await addSubmissionToQueue(data)
        throw new OfflineError()
      }

      try {
        const result = await submitChecklist(data, companyId)
        return result
      } catch (error) {
        if (error instanceof NetworkError) {
          await addSubmissionToQueue(data)
        }
        throw error
      }
    },
    onSuccess: () => {
      localStorageLockedRef.current = true
      localStorage.setItem('checklistData', JSON.stringify(defaultValues))
      form.reset(defaultValues)
      sigRef.current?.clear()
      toast({
        title: 'Success',
        description: 'Checklist saved to database',
        variant: 'success',
      })
    },
    onError: (error: Error) => {
      if (error instanceof OfflineError || error instanceof NetworkError) {
        localStorageLockedRef.current = true
        localStorage.setItem('checklistData', JSON.stringify(defaultValues))
        form.reset(defaultValues)
        sigRef.current?.clear()
        toast({
          title: 'Offline Mode',
          description: 'No internet. Form saved and will be sent automatically when online.',
          variant: 'default',
          duration: 6000,
        })
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Checklist could not be saved. Please check the form.',
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

  const handleSubmit = (data: ChecklistFormData) => {
    mutate(data)
  }

  return (
    <div className='flex justify-center py-10'>
      <div className='w-full max-w-xl border rounded-md bg-white p-8 shadow-sm'>
        <img
          src={companyId === 1 ? gbColumbus : companyId === 3 ? gbIndianapolis : companyId === 4 ? gmqTops : ''}
          alt='Logo'
          className='mx-auto mb-4 h-46 object-contain'
        />
        <h1 className='mb-6 text-center text-2xl font-semibold'>
          Post-installation check list
        </h1>

        {!isOnline && (
          <div className='mb-4 p-3 bg-orange-100 border border-orange-400 rounded-md'>
            <p className='text-sm font-medium text-orange-800'>
              No internet connection
            </p>
            <p className='text-xs text-orange-700 mt-1'>
              Form will be saved and sent automatically when connection is restored.
            </p>
          </div>
        )}

        {isProcessing && (
          <div className='mb-4 p-3 bg-blue-100 border border-blue-400 rounded-md'>
            <div className='flex items-center gap-3'>
              <div className='text-blue-600 animate-pulse'>🔄</div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-blue-800'>
                  Sending pending checklists...
                </p>
                <p className='text-xs text-blue-700 mt-1'>
                  Processing {pendingCount} pending submission{pendingCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {hasPendingSubmissions && !isProcessing && (
          <div className='mb-4 p-3 bg-blue-100 border border-blue-400 rounded-md'>
            <div className='flex justify-between items-start gap-3'>
              <div className='flex-1'>
                <p className='text-sm font-medium text-blue-800'>
                  {pendingCount} pending checklist{pendingCount !== 1 ? 's' : ''} waiting to be sent
                </p>
                <p className='text-xs text-blue-700 mt-1'>
                  {isOnline
                    ? 'Will be sent automatically'
                    : 'Will be sent when connection is restored'}
                </p>
                {pendingSubmissions.some(s => s.status === 'failed') && (
                  <div className='mt-2 space-y-1'>
                    {pendingSubmissions
                      .filter(s => s.status === 'failed')
                      .map(submission => (
                        <div key={submission.id} className='flex items-center justify-between bg-red-50 p-2 rounded'>
                          <div className='flex-1'>
                            <p className='text-xs font-medium text-red-800'>
                              Failed after {submission.attempts} attempts
                            </p>
                            <p className='text-xs text-red-700'>
                              {new Date(submission.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type='button'
                            onClick={() => {
                              if (confirm('Delete this failed submission?')) {
                                deleteSubmission(submission.id!)
                              }
                            }}
                            className='text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors'
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    <button
                      type='button'
                      onClick={() => {
                        if (confirm('Clear all failed submissions?')) {
                          clearFailedSubmissions()
                        }
                      }}
                      className='text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors mt-2'
                    >
                      Clear All Failed
                    </button>
                  </div>
                )}
              </div>
              {isOnline && !isProcessing && (
                <button
                  type='button'
                  onClick={processQueue}
                  className='text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors whitespace-nowrap'
                >
                  Send Now
                </button>
              )}
            </div>
          </div>
        )}

        <FormProvider {...form}>
          <form
            method='post'
            onSubmit={e => {
              e.preventDefault()
              form.handleSubmit(handleSubmit)(e)
            }}
          >
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
                  ? 'Sending pending forms...'
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
