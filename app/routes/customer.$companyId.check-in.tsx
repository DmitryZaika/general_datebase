import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { z } from 'zod'
import { EmailInput } from '~/components/molecules/EmailInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PhoneInput } from '~/components/molecules/PhoneInput'
import { AddressInput } from '~/components/organisms/AddressInput'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { useToast } from '~/hooks/use-toast'
import { createCustomerMutation, sourceEnum } from '~/schemas/customers'
import { getSession } from '~/sessions.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import {
  FormControl,
  FormField,
  FormLabel as FormFieldLabel,
  FormItem,
  FormMessage,
  FormProvider,
} from '../components/ui/form'

const referralOptions = [
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'referral', label: 'Referral' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'drive-thru', label: 'Drive-thru' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other', label: 'Other' },
]

const customerCheckInSchema = z.object({
  company_id: z.number().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.email('Invalid email address'),
  address: z.string().optional(),
  address_zip_code: z.string().optional(),
  source: z.enum(sourceEnum),
  referral_source: z
    .enum([
      'google',
      'facebook',
      'referral',
      'flyer',
      'drive-thru',
      'instagram',
      'other',
    ])
    .optional(),
  safety_instructions_acknowledged: z
    .boolean()
    .refine(val => val === true, 'You must acknowledge the safety instructions'),
})

type CheckInFormData = z.infer<typeof customerCheckInSchema>
const resolver = zodResolver(customerCheckInSchema)

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (_error) {
    return redirect('/login')
  }
  const paramCompanyId = Number(params.companyId)
  if (!Number.isFinite(paramCompanyId) || paramCompanyId <= 0) {
    return redirect('/login')
  }
  if (paramCompanyId !== user.company_id) {
    return redirect(`/customer/${user.company_id}/check-in`)
  }
  const activeSession = session.data.sessionId || null
  return data({ companyId: paramCompanyId, activeSession })
}

export default function CustomerCheckIn() {
  const { toast } = useToast()
  const { companyId, activeSession } = useLoaderData<typeof loader>()

  const form = useForm<CheckInFormData>({
    resolver,
    defaultValues: {
      company_id: companyId,
      name: '',
      phone: '',
      email: '',
      address: '',
      address_zip_code: '',
      referral_source: undefined,
      safety_instructions_acknowledged: false,
      source: 'check-in',
    },
  })

  const resetToDefaults = () => {
    form.reset({
      company_id: companyId,
      name: '',
      phone: '',
      email: '',
      address: '',
      address_zip_code: '',
      referral_source: undefined,
      safety_instructions_acknowledged: false,
      source: 'check-in',
    })
    setDupOpen(false)
  }

  const onSuccess = () => {
    toast({
      title: 'Check-in successful',
      description: 'Thank you for checking in. We look forward to assisting you!',
      variant: 'success',
    })
    resetToDefaults()
    setDupOpen(false)
  }

  const { mutate, isPending } = useMutation(createCustomerMutation(toast, onSuccess))

  const [dupOpen, setDupOpen] = useState(false)
  const [dupInfo, setDupInfo] = useState<{
    name: string
    sales_rep_name: string | null
  } | null>(null)

  const phoneValue = form.watch('phone')
  const emailValue = form.watch('email')
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (phoneValue && phoneValue.trim() !== '') params.set('phone', phoneValue.trim())
    if (emailValue && emailValue.trim() !== '') params.set('email', emailValue.trim())
    return params.toString()
  }, [phoneValue, emailValue])

  const safetyInstructions = (
    <section className='mt-4 rounded-lg bg-gradient-to-br from-gray-50 to-white p-6 shadow-inner'>
      <h2 className='mb-4 text-center text-lg font-semibold text-gray-800'>
        We kindly ask you to:
      </h2>
      <ol className='list-decimal space-y-3 pl-5 text-left text-sm text-gray-700 md:text-base'>
        <li>
          <span className='font-medium'>
            Refrain from moving slabs or remnants by yourself.
          </span>
          &nbsp;If you require help lifting or moving heavy countertops or materials,
          please ask a staff member for assistance. Granite Depot is not responsible for
          any injuries obtained.
        </li>
        <li>
          <span className='font-medium'>
            Avoid leaning on countertops and be cautious of sharp edges.
          </span>
          &nbsp;Display units may not be securely anchored. Avoid running your hands or
          body against these surfaces to prevent cuts or injuries.
        </li>
        <li>
          <span className='font-medium'>Keep children supervised.</span>
          &nbsp;Ensure children are closely supervised while in the shop to prevent
          accidents or injuries. Do not allow them to climb on or play around
          countertops or machinery.
        </li>
        <li>
          <span className='font-medium'>Stay within designated areas.</span>
          &nbsp;Customers should remain in designated customer areas and avoid entering
          restricted or work-only zones to ensure their safety.
        </li>
        <li>
          <span className='font-medium'>Use caution on slippery surfaces.</span>
          &nbsp;Be mindful of potentially slippery surfaces, especially in wet or
          freshly cleaned areas. Walk slowly and carefully to avoid slips or falls.
        </li>
        <li>
          <span className='font-medium'>Report any concerns.</span>
          &nbsp;If you notice any safety concerns or potential hazards, please inform a
          staff member immediately. Your vigilance helps maintain a safe shopping
          environment.
        </li>
      </ol>
    </section>
  )

  return (
    <div className='flex justify-center py-10'>
      <div className='w-full max-w-2xl rounded-md border bg-white p-8 shadow-sm'>
        <h1 className='text-center text-2xl font-semibold'>Safety Instructions</h1>
        {safetyInstructions}

        <FormProvider {...form}>
          <Form
            onSubmit={form.handleSubmit(async formData => {
              if (queryString) {
                if (!activeSession) {
                  toast({ title: 'Need to login', variant: 'destructive' })
                  return
                }
                const res = await fetch(`/api/customers/duplicate-check?${queryString}`)
                const js = await res.json()
                const match =
                  Array.isArray(js.matches) && js.matches.length > 0
                    ? js.matches[0]
                    : null
                if (match) {
                  setDupInfo({
                    name: match.name,
                    sales_rep_name: match.sales_rep_name || null,
                  })
                  setDupOpen(true)
                  return
                }
              }
              mutate(formData)
            })}
          >
            <div className='space-y-4 py-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <InputItem name='Name' placeholder='Your full name' field={field} />
                )}
              />

              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => <PhoneInput field={field} />}
              />

              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <EmailInput field={field} formClassName='mb-0' />
                )}
              />

              <AddressInput
                form={form}
                field='address'
                zipField='address_zip_code'
                type='project'
              />

              <FormField
                control={form.control}
                name='referral_source'
                render={({ field }) => (
                  <div className='space-y-3'>
                    <Label className='text-base font-medium'>
                      How did you hear about us?
                    </Label>
                    <div className='mt-3 grid grid-cols-2 gap-4'>
                      {referralOptions.map(option => (
                        <div key={option.value} className='flex items-center space-x-2'>
                          <input
                            type='radio'
                            id={option.value}
                            value={option.value}
                            checked={field.value === option.value}
                            onChange={e => field.onChange(e.target.value)}
                            className='h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500'
                          />
                          <Label htmlFor={option.value} className='font-normal'>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name='safety_instructions_acknowledged'
                render={({ field }) => (
                  <FormItem className='pt-2'>
                    <div className='flex items-start space-x-2'>
                      <FormControl>
                        <Checkbox
                          id='safety_instructions'
                          className='h-5 w-5'
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormFieldLabel
                        htmlFor='safety_instructions'
                        className='text-sm font-normal leading-5'
                      >
                        I acknowledge that I have read, understand, and agree to the
                        safety instructions.
                      </FormFieldLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='flex justify-center gap-3'>
              <LoadingButton loading={isPending} type='submit' className='h-11 w-30'>
                Submit
              </LoadingButton>
            </div>

            {/* Polished duplicate dialog */}
            <Dialog open={dupOpen} onOpenChange={setDupOpen}>
              {/* Hide the default close (X) button inside shadcn DialogContent */}
              <DialogContent
                className='
      sm:max-w-md p-0 overflow-hidden
      [&>button]:hidden
      '
              >
                {/* Header with soft gradient and icon */}
                <div className='flex items-start gap-3 border-b bg-red-500 p-6'>
                  <div className='flex h-10 w-10 items-center bg-gr justify-center rounded-full  shadow-sm'>
                    <AlertTriangle className='h-5 w-5 text-white' />
                  </div>
                  <div className='space-y-1 '>
                    <DialogTitle className='text-white font-semibold'>
                      Possible duplicate found
                    </DialogTitle>
                    <DialogDescription className='text-sm text-white'>
                      We found an existing customer in the system that may match your
                      entry.
                    </DialogDescription>
                  </div>
                </div>

                {/* Body */}
                <div className='space-y-3 p-6'>
                  <div className='rounded-lg border bg-white p-4'>
                    <p className='mb-1 text-sm text-muted-foreground'>Customer</p>
                    <p className='text-base font-medium'>{dupInfo?.name}</p>
                  </div>
                  <div className='rounded-lg border bg-white p-4'>
                    <p className='mb-1 text-sm text-muted-foreground'>Sales rep</p>
                    <p className='text-base font-medium'>
                      {dupInfo?.sales_rep_name || 'Unassigned'}
                    </p>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    If this is the same person, please avoid creating a duplicate to
                    keep records clean.
                  </p>
                </div>

                {/* Footer actions (no top-right X) */}
                <DialogFooter className='flex items-center justify-end gap-2 bg-gray-50 px-6 py-4'>
                  <Button type='button' className='h-11' onClick={resetToDefaults}>
                    Clear form
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Form>
        </FormProvider>
      </div>
    </div>
  )
}
