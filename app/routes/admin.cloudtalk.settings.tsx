import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormProvider } from '~/components/ui/form'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import type { Nullable } from '~/types/utils'
import { csrf } from '~/utils/csrf.server'
import { formatPhoneForDisplay, normalizeToE164 } from '~/utils/phone'
import { selectId } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const schema = z.object({
  cloudtalk_sms_sender: z.string(),
})
const resolver = zodResolver(schema)

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getAdminUser(request)
  const company = await selectId<{ cloudtalk_sms_sender: Nullable<string> }>(
    db,
    'SELECT cloudtalk_sms_sender FROM company WHERE id = ?',
    user.company_id,
  )
  return { sender: company?.cloudtalk_sms_sender ?? '' }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAdminUser(request)
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const { errors, data, receivedValues } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }

  const raw = data.cloudtalk_sms_sender.trim()
  let value: Nullable<string> = null
  if (raw.length > 0) {
    const e164 = normalizeToE164(raw)
    if (!e164) {
      return {
        errors: {
          cloudtalk_sms_sender: {
            type: 'manual',
            message: 'Enter a valid phone number, e.g. +13175551234',
          },
        },
      }
    }
    value = e164
  }

  await db.execute('UPDATE company SET cloudtalk_sms_sender = ? WHERE id = ?', [
    value,
    user.company_id,
  ])

  const session = await getSession(request.headers.get('Cookie'))
  session.flash(
    'message',
    toastData(
      'Success',
      value ? 'SMS sender number saved' : 'SMS sender number cleared',
    ),
  )
  return redirect('/admin/cloudtalk', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function CloudTalkSmsSettings() {
  const { sender } = useLoaderData<typeof loader>()
  const actionData = useActionData<{
    error?: string
    errors?: { cloudtalk_sms_sender?: { message?: string } }
  }>()
  const navigate = useNavigate()
  const token = useAuthenticityToken()

  const form = useForm({
    resolver,
    defaultValues: { cloudtalk_sms_sender: sender },
  })
  const fullSubmit = useFullSubmit(form, undefined, 'POST', undefined, true)
  const isSubmitting = form.formState.isSubmitting
  const trimmed = (form.watch('cloudtalk_sms_sender') ?? '').trim()
  const previewE164 = normalizeToE164(trimmed)
  const previewHint =
    trimmed.length === 0
      ? 'No sender configured — sending is disabled.'
      : previewE164
        ? `Will be saved as ${previewE164} (${formatPhoneForDisplay(previewE164)}).`
        : 'Not a valid phone number yet.'

  useEffect(() => {
    const fieldError = actionData?.errors?.cloudtalk_sms_sender
    if (!fieldError) return
    form.setError('cloudtalk_sms_sender', {
      type: 'server',
      message: fieldError.message ?? 'invalid',
    })
  }, [actionData, form])

  const close = () => navigate('/admin/cloudtalk')

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open) close()
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>CloudTalk SMS settings</DialogTitle>
          <DialogDescription>
            The CloudTalk SMS-capable number messages are sent from. Must be a number
            provisioned for SMS in CloudTalk. Leave empty to disable sending.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit} className='space-y-3'>
            <input type='hidden' name='csrf' value={token} />
            {actionData?.error && (
              <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
                {actionData.error}
              </div>
            )}
            <FormField
              control={form.control}
              name='cloudtalk_sms_sender'
              render={({ field }) => (
                <InputItem
                  name='Sender number'
                  placeholder='+1 317 555 1234'
                  field={field}
                  inputAutoFocus
                />
              )}
            />
            <p className='text-xs text-slate-500'>{previewHint}</p>
            <DialogFooter className='mt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={close}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' variant='blue' disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
