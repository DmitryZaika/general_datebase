import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
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
import { commitSession, getSession } from '~/sessions'
import { toastData } from '~/utils/toastHelpers'

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  message: z.string().min(1, 'Message is required'),
  address: z.string().optional(),
})

type FormData = z.infer<typeof leadSchema>
const resolver = zodResolver(leadSchema)

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  return { data }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  await db.execute(
    `INSERT INTO customers (name, email, phone, your_message, address) VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.email, data.phone, data.message, data.address],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Lead added'))
  return redirect('..', { headers: { 'Set-Cookie': await commitSession(session) } })
}

export const AddLead = () => {
  const navigate = useNavigate()
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  const form = useForm<FormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
      address: '',
    },
  })
  const fullSubmit = useFullSubmit(form)
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='leadForm' method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem
                  inputAutoFocus={true}
                  name={'Name'}
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
              name='message'
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder={'Message of the lead'}
                  className={cn(form.formState.errors.message && 'border-red-500')}
                />
              )}
            />
            <AddressInput form={form} field='address' type='project' />{' '}
            <DialogFooter>
              <LoadingButton type='submit' loading={false}>
                Add Lead
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

export default AddLead
