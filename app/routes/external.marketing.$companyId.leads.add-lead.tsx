import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useNavigate,
  useNavigation,
} from 'react-router'
import { z } from 'zod'
import { EmailInput } from '~/components/molecules/EmailInput'
import { FileInput } from '~/components/molecules/FileInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { PhoneInput } from '~/components/molecules/PhoneInput'
import { SelectInput } from '~/components/molecules/SelectItem'
import { AddressInput } from '~/components/organisms/AddressInput'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormProvider } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { cn } from '~/lib/utils'
import { sourceEnum } from '~/schemas/customers'
import { NullableString } from '~/schemas/general'
import { commitSession, getSession } from '~/sessions.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { getMarketingUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { useCustomOptionalForm } from '~/utils/useCustomForm'

const LAMBDA_URL = process.env.LAMBDA_URL || ''

const referralSourceEnum = [
  'missed call',
  'email',
  'website seo',
  'website ads',
  'website social',
  'marketplace',
  'google',
  'facebook',
  'instagram',
] as const

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: NullableString,
  phone: NullableString,
  your_message: NullableString,
  address: NullableString,
  source: z.enum(sourceEnum),
  referral_source: z.enum(referralSourceEnum),
})

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const companyId = Number(params.companyId)
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return redirect(`/login?error=invalid_company_id`)
  }
  try {
    await getMarketingUser(request, companyId)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const paramCompanyId = Number(params.companyId)
  if (!Number.isFinite(paramCompanyId) || paramCompanyId <= 0) {
    return redirect(`/login?error=invalid_company_id`)
  }
  try {
    await getMarketingUser(request, paramCompanyId)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const { errors, data } = await parseMutliForm(request, leadSchema, 'leads')
  if (errors || !data) {
    return { errors }
  }

  const body = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    your_message: data.your_message,
    address: data.address,
    source: 'leads',
    company_id: paramCompanyId,
    referral_source: data.referral_source ?? null,
    file: data.file || '',
  }

  const cleaned = Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      value === 'undefined' ? null : value,
    ]),
  )
  const response = await fetch(
    `${`${LAMBDA_URL}v1/webhooks/new-lead-form/${paramCompanyId}`}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleaned),
    },
  )

  const session = await getSession(request.headers.get('Cookie'))

  if (response.ok) {
    session.flash('message', toastData('Success', 'Lead added'))
  } else {
    session.flash('message', toastData('Error', 'Failed to add lead', 'destructive'))
  }
  return redirect('..', { headers: { 'Set-Cookie': await commitSession(session) } })
}

export const AddLead = () => {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  const form = useCustomOptionalForm(leadSchema, {
    defaultValues: {
      source: 'leads',
      your_message: '',
      address: '',
      email: '',
      phone: '',
    },
  })
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <MultiPartForm form={form}>
            <input type='hidden' value='leads' {...form.register('source')} />
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem
                  inputAutoFocus={true}
                  name={'Name*'}
                  placeholder={'Name of the lead'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => <EmailInput field={field} />}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => <PhoneInput field={field} />}
            />
            <FormField
              control={form.control}
              name='your_message'
              render={({ field }) => (
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  name={'Message'}
                  placeholder={'Message of the lead'}
                  className={cn(form.formState.errors.your_message && 'border-red-500')}
                />
              )}
            />
            <AddressInput form={form} field='address' type='project' />{' '}
            <FormField
              control={form.control}
              name='referral_source'
              render={({ field }) => (
                <SelectInput
                  field={field}
                  name='Referral Source'
                  options={referralSourceEnum.map(source => ({
                    key: source,
                    value: source.charAt(0).toUpperCase() + source.slice(1),
                  }))}
                  placeholder='Select referral source'
                />
              )}
            />
            <FormField
              control={form.control}
              name='file'
              render={({ field }) => (
                <FileInput
                  inputName='file'
                  id='image'
                  onChange={field.onChange}
                  type='image'
                />
              )}
            />
            <DialogFooter>
              <LoadingButton type='submit' loading={isSubmitting}>
                Add Lead
              </LoadingButton>
            </DialogFooter>
          </MultiPartForm>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

export default AddLead
