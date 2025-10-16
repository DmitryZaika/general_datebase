import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { EmailInput } from '~/components/molecules/EmailInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PhoneInput } from '~/components/molecules/PhoneInput'
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
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { cn } from '~/lib/utils'
import { sourceEnum } from '~/schemas/customers'
import { commitSession, getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getMarketingUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  your_message: z.string().optional(),
  address: z.string().optional(),
  source: z.enum(sourceEnum),
  // referral_source: z.enum(referralSourceEnum).optional(),
})

type FormData = z.infer<typeof leadSchema>
const resolver = zodResolver(leadSchema)

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const paramCompanyId = Number(params.companyId)
  if (!Number.isFinite(paramCompanyId) || paramCompanyId <= 0) {
    return redirect(`/login?error=invalid_company_id`)
  }
  try {
    await getMarketingUser(request, paramCompanyId)

    const leadId = parseInt(params.leadId || '0')

    if (!leadId) {
      throw new Error('Invalid lead ID')
    }

    // Fetch lead data from database
    const leads = await selectMany<{
      id: number
      name: string
      email: string
      phone: string
      address: string
      source: string
      your_message: string
    }>(
      db,
      'SELECT id, name, email, phone, address, source, your_message FROM customers WHERE id = ? AND company_id = ?',
      [leadId, paramCompanyId],
    )
    const lead = leads[0]

    if (!lead) {
      throw new Error('Lead not found')
    }

    return { lead }
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

  const { errors, data } = await getValidatedFormData<FormData>(request, resolver)
  if (errors) {
    return { errors }
  }

  const leadId = parseInt(params.leadId || '0')
  if (!leadId) {
    return { error: 'Invalid lead ID' }
  }

  try {
    await db.execute(
      'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, your_message = ? WHERE id = ? AND company_id = ?',
      [
        data.name,
        data.email || null,
        data.phone || null,
        data.address || null,
        data.your_message || null,
        leadId,
        paramCompanyId,
      ],
    )
  } catch {
    return { error: 'Failed to update lead' }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Lead updated'))
  return redirect('..', { headers: { 'Set-Cookie': await commitSession(session) } })
}

export const LeadEdit = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { lead } = useLoaderData<typeof loader>()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }

  const form = useForm<FormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      your_message: lead.your_message || '',
      address: lead.address || '',
      source: (lead.source as 'leads' | 'check-in') || 'leads',
    },
  })

  const fullSubmit = useFullSubmit(form)
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Lead: {lead.name}</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form id='leadEditForm' method='post' onSubmit={fullSubmit}>
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
                  name={'Message'}
                  placeholder={'Message of the lead'}
                  className={cn(form.formState.errors.your_message && 'border-red-500')}
                />
              )}
            />

            <AddressInput form={form} field='address' type='project' />
            <DialogFooter>
              <LoadingButton type='submit' loading={false}>
                Update Lead
              </LoadingButton>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

export default LeadEdit
