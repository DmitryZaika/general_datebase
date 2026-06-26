import type { ResultSetHeader } from 'mysql2'
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
import { db } from '~/db.server'
import { cn } from '~/lib/utils'
import { sourceEnum } from '~/schemas/customers'
import { NullableString } from '~/schemas/general'
import { commitSession, getSession } from '~/sessions.server'
import { parseOptionalMultiForm } from '~/utils/parseMultiForm'
import { posthogClient } from '~/utils/posthog.server'
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
  phone: z.preprocess(
    val =>
      val === null ||
      val === undefined ||
      (typeof val === 'string' && val.trim() === '')
        ? undefined
        : val,
    z.string().optional(),
  ),
  your_message: NullableString,
  address: NullableString,
  source: z.enum(sourceEnum),
  referral_source: z.enum(referralSourceEnum),
})

type LeadFormData = z.infer<typeof leadSchema>

function hasPhone(phone?: string | null): boolean {
  return Boolean(phone?.trim())
}

async function insertMarketingLead(
  companyId: number,
  data: LeadFormData,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `INSERT INTO customers (name, phone, email, address, your_message, referral_source, source, company_id)
     VALUES (?, ?, ?, ?, ?, ?, 'leads', ?)`,
    [
      data.name,
      data.phone?.trim() || null,
      data.email || null,
      data.address || null,
      data.your_message || null,
      data.referral_source ?? null,
      companyId,
    ],
  )
}

async function flashAndRedirect(
  session: Awaited<ReturnType<typeof getSession>>,
  title: string,
  description: string,
  variant: 'success' | 'destructive' = 'success',
) {
  session.flash('message', toastData(title, description, variant))
  return redirect('..', { headers: { 'Set-Cookie': await commitSession(session) } })
}

async function notifyLeadWebhook(
  companyId: number,
  data: LeadFormData & { file?: string | string[] },
) {
  if (!LAMBDA_URL || !hasPhone(data.phone)) return

  const fileValue = Array.isArray(data.file) ? data.file[0] : data.file

  const body = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    your_message: data.your_message,
    address: data.address,
    source: 'leads',
    company_id: companyId,
    referral_source: data.referral_source ?? null,
    file: fileValue || '',
  }
  const cleaned = Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      value === 'undefined' ? null : value,
    ]),
  )
  const webhookUrl = `${LAMBDA_URL.replace(/\/$/, '')}/v1/webhooks/new-lead-form/${companyId}`

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleaned),
    })
    if (!response.ok) {
      posthogClient.captureException(
        new Error('Failed to notify lead webhook'),
        'failed_to_add_lead',
        {
          companyId,
        },
      )
    }
  } catch (err) {
    posthogClient.captureException(
      err instanceof Error ? err : new Error(String(err)),
      'add_lead_fetch',
      { companyId, url: webhookUrl },
    )
  }
}

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
  const { errors, data } = await parseOptionalMultiForm(request, leadSchema, 'leads')
  if (errors || !data) {
    return { errors }
  }

  const session = await getSession(request.headers.get('Cookie'))

  try {
    await insertMarketingLead(paramCompanyId, data)
  } catch (err) {
    posthogClient.captureException(
      err instanceof Error ? err : new Error(String(err)),
      'add_lead_db_insert',
      { paramCompanyId },
    )
    return flashAndRedirect(session, 'Error', 'Failed to add lead', 'destructive')
  }

  await notifyLeadWebhook(paramCompanyId, data)

  return flashAndRedirect(session, 'Success', 'Lead added')
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
              render={({ field }) => <PhoneInput field={field} inputName='Phone' />}
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
