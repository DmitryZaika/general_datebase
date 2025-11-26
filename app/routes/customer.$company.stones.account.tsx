import {
  type ActionFunctionArgs,
  Form,
  redirect,
  useActionData,
  useLocation,
  useNavigate,
  useNavigation,
  useParams,
} from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

type ActionData = {
  error?: string
  email?: string
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const emailValue = formData.get('email')
  const email = typeof emailValue === 'string' ? emailValue.trim() : ''

  if (!email) {
    const result: ActionData = { error: 'Email is required', email }
    return result
  }

  const customers = await selectMany<{ company_id: number; viewId: string }>(
    db,
    'SELECT company_id, BIN_TO_UUID(view_id) as viewId FROM customers WHERE email = ? LIMIT 1',
    [email],
  )

  const customer = customers[0]

  if (!customer) {
    const result: ActionData = { error: 'Customer with this email was not found', email }
    return result
  }

  return redirect(`/customer/${customer.company_id}/${customer.viewId}`)
}

export default function CustomerAccount() {
  const actionData = useActionData<ActionData>()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const companyId = params.company
  const defaultEmail = actionData && actionData.email ? actionData.email : ''
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (companyId) {
        navigate(`/customer/${companyId}/stones`)
      } else {
        navigate(`..${location.search}`)
      }
    }
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Access your account</DialogTitle>
        </DialogHeader>
        {actionData && actionData.error && (
          <div className='mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {actionData.error}
          </div>
        )}
        <Form method='post' className='space-y-4'>
          <div className='space-y-1'>
            <label htmlFor='email' className='text-sm font-medium text-slate-800'>
              Email
            </label>
            <Input
              id='email'
              name='email'
              type='email'
              defaultValue={defaultEmail}
              placeholder='you@example.com'
              required
            />
          </div>
          <LoadingButton loading={isSubmitting} type='submit' >
            Submit
          </LoadingButton>
        </Form>
      </DialogContent>
    </Dialog>
  )
}