import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { data, Form, type LoaderFunctionArgs, useLoaderData } from 'react-router'
import { z } from 'zod'
import { EmailInput } from '~/components/molecules/EmailInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PhoneInput } from '~/components/molecules/PhoneInput'
import { AddressInput } from '~/components/organisms/AddressInput'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { useToast } from '~/hooks/use-toast'
import { createCustomerMutation } from '~/schemas/customers'
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
  email: z.string().optional(),
  address: z.string().optional(),
  address_zip_code: z.string().optional(),
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

export function loader({ params }: LoaderFunctionArgs) {
  const { companyId } = params
  return data({ companyId: parseInt(companyId as string) })
}

export default function CustomerCheckIn() {
  const { toast } = useToast()
  const { companyId } = useLoaderData<typeof loader>()

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
    },
  })

  const onSuccess = () => {
    toast({
      title: 'Check-in successful',
      description: 'Thank you for checking in. We look forward to assisting you!',
      variant: 'success',
    })
    form.reset()
  }

  const { mutate, isPending } = useMutation(createCustomerMutation(toast, onSuccess))

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
      <div className='w-full max-w-2xl border rounded-md bg-white p-8 shadow-sm'>
        <img
          src='https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp'
          alt='Logo'
          className='mx-auto mb-4 h-16 object-contain'
        />
        <h1 className=' text-center text-2xl font-semibold'>Safety Instructions</h1>
        {safetyInstructions}
        <FormProvider {...form}>
          <Form onSubmit={form.handleSubmit(data => mutate(data))}>
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
                    <Label className='text-base font-medium '>
                      How did you hear about us?
                    </Label>
                    <div className='grid grid-cols-2 gap-4 mt-3'>
                      {referralOptions.map(option => (
                        <div key={option.value} className='flex items-center space-x-2'>
                          <input
                            type='radio'
                            id={option.value}
                            value={option.value}
                            checked={field.value === option.value}
                            onChange={e => field.onChange(e.target.value)}
                            className='w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500'
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

            <div className=' flex justify-center'>
              <LoadingButton loading={isPending} type='submit' className='w-30 h-11'>
                Submit
              </LoadingButton>
            </div>
          </Form>
        </FormProvider>
      </div>
    </div>
  )
}
