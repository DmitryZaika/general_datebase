import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { SelectInputOther } from '~/components/molecules/SelectInputOther'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { LOST_REASONS } from '~/utils/constants'
import { csrf } from '~/utils/csrf.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const ALLOWED_INVALID_KEYS = [
  'Wrong number, email, etc.',
  'Out of area',
  'Accident submission',
  'Looking for unrelated service',
]

const options = Object.keys(LOST_REASONS)
  .filter(key => ALLOWED_INVALID_KEYS.includes(key))
  .map(key => ({
    key: String(LOST_REASONS[key as keyof typeof LOST_REASONS]).toLowerCase(),
    value: LOST_REASONS[key as keyof typeof LOST_REASONS],
  }))

const schema = z.object({ invalid_lead: z.string().min(1) })

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const customerId = params.customerId ? Number(params.customerId) : 0
  if (!customerId) return { error: 'Bad id' }

  const formData = await request.formData()
  const invalid_lead = String(formData.get('invalid_lead') || '')

  try {
    schema.parse({ invalid_lead })
  } catch {
    return { error: 'Invalid value' }
  }

  const mapped = (
    options.find(o => o.key === invalid_lead)?.value ?? invalid_lead
  ).toString()

  await db.execute(
    'UPDATE customers SET invalid_lead = ?, sales_rep = NULL, assigned_date = NULL WHERE id = ?',
    [mapped, customerId],
  )
  await db.execute('UPDATE deals SET deleted_at = NOW() WHERE customer_id = ?', [
    customerId,
  ])
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Customer marked invalid'))
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const customerId = params.customerId ? Number(params.customerId) : 0
  if (!customerId) return { customer_name: undefined, current: '' }

  const row = await selectId<{ name: string; invalid_lead: string | null }>(
    db,
    'SELECT name, invalid_lead FROM customers WHERE id = ?',
    customerId,
  )
  return { customer_name: row?.name, current: row?.invalid_lead ?? '' }
}

export default function InvalidCustomerDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { customer_name, current } = useLoaderData<typeof loader>()
  const normalize = (s: string) => s.toLowerCase().replaceAll('.', '').trim()
  const matched = current
    ? options.find(o => normalize(o.value) === normalize(current))
    : undefined
  const initialValue = matched ? matched.key : ''
  const form = useForm<{ invalid_lead: string }>({
    resolver: zodResolver(schema),
    defaultValues: { invalid_lead: initialValue },
  })

  const handleChange = (open: boolean) => {
    if (open === false) navigate(`..${location.search}`)
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[420px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Mark invalid: {customer_name}</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form method='post'>
            <AuthenticityTokenInput />
            <FormField
              control={form.control}
              name='invalid_lead'
              render={({ field }) => (
                <SelectInputOther
                  name='Reason'
                  options={options}
                  field={field}
                  placeholder='Select reason'
                />
              )}
            />
            <div className='flex justify-end gap-2 mt-4'>
              <Button type='button' variant='outline' onClick={() => navigate('..')}>
                Cancel
              </Button>
              <Button type='submit'>Save</Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
