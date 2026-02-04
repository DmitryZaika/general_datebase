import { FormProvider, useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useSearchParams,
  useSubmit,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
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
import { commitSession, getSession } from '~/sessions.server'
import { getSearchString, LOST_REASONS } from '~/utils/constants'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { replaceUnderscoresWithSpaces } from '~/utils/words'

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request)
  const formData = await request.formData()
  const intent = String(formData.get('intent') || '')
  const dealId = Number(formData.get('dealId') || 0)
  const fromListId = Number(formData.get('fromListId') || 0)
  const fromPos = Number(formData.get('fromPos') || 0)
  const reason = String(formData.get('reason') || '')

  if (!Number.isFinite(dealId) || dealId <= 0) {
    return redirect(`/employee/deals${getSearchString(new URL(request.url))}`)
  }

  if (intent === 'cancel') {
    await db.execute(
      'UPDATE deals SET list_id = ?, position = ? WHERE id = ? AND user_id = ?',
      [fromListId || null, fromPos || 0, dealId, user.id],
    )
    await db.execute(
      'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
      [dealId],
    )
    if (fromListId) {
      await db.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealId, fromListId],
      )
    }
    return redirect(
      `/employee/deals${getSearchString(new URL(request.url))}?highlight=${dealId}`,
    )
  }

  if (intent === 'submit') {
    if (!reason || reason === 'not_specified') {
      return redirect(
        `/employee/deals${getSearchString(new URL(request.url))}?dealId=${dealId}&fromListId=${fromListId}&fromPos=${fromPos}&error=Reason is required`,
      )
    }
    await db.execute(
      'UPDATE deals SET lost_reason = ?, is_won = 0 WHERE id = ? AND user_id = ?',
      [reason, dealId, user.id],
    )
    await db.execute(
      'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
      [dealId],
    )
    await db.execute(
      'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
      [dealId, 5],
    )

    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Success', 'Deal lost reason updated successfully'),
    )
    return redirect(`/employee/deals${getSearchString(new URL(request.url))}`, {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  return redirect(`/employee/deals${getSearchString(new URL(request.url))}`)
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await getEmployeeUser(request)
  const url = new URL(request.url)
  const dealId = Number(url.searchParams.get('dealId') || 0)
  const fromListId = Number(url.searchParams.get('fromListId') || 0)
  const fromPos = Number(url.searchParams.get('fromPos') || 0)
  if (!Number.isFinite(dealId) || dealId <= 0) {
    return redirect('/employee/deals')
  }
  return { dealId, fromListId, fromPos }
}

function EmployeeDealsReason() {
  const { dealId, fromListId, fromPos } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')
  const form = useForm<{ reason: string }>({
    defaultValues: { reason: '' },
  })
  const reasonValue = form.watch('reason')
  const submit = useSubmit()
  const handleChange = (open: boolean) => {
    if (open) return
    const fd = new FormData()
    fd.append('dealId', String(dealId))
    fd.append('fromListId', String(fromListId))
    fd.append('fromPos', String(fromPos))
    fd.append('intent', 'cancel')
    submit(fd, { method: 'post' })
  }
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Closed Lost</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form method='post' className='space-y-4'>
            <AuthenticityTokenInput />
            <input type='hidden' name='dealId' value={String(dealId)} />
            <input type='hidden' name='fromListId' value={String(fromListId)} />
            <input type='hidden' name='fromPos' value={String(fromPos)} />

            <FormField
              control={form.control}
              name='reason'
              render={({ field }) => (
                <div className='space-y-2'>
                  <SelectInputOther
                    field={field}
                    placeholder='Select reason'
                    name={replaceUnderscoresWithSpaces('lost_reason')}
                    options={[
                      ...Object.keys(LOST_REASONS).map(key => ({
                        key: key,
                        value: replaceUnderscoresWithSpaces(
                          LOST_REASONS[key as keyof typeof LOST_REASONS],
                        ),
                      })),
                    ]}
                  />
                  {error && (
                    <p className='text-sm font-medium text-destructive'>{error}</p>
                  )}
                </div>
              )}
            />
            <input type='hidden' name='reason' value={reasonValue || ''} />

            <div className='flex gap-2'>
              <Button type='submit' name='intent' value='cancel' variant='secondary'>
                Cancel
              </Button>
              <Button type='submit' name='intent' value='submit'>
                Submit
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

export default EmployeeDealsReason
