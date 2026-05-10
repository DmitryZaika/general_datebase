import { useEffect, useRef, useState } from 'react'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { deleteCustomerFromCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { csrf } from '~/utils/csrf.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

async function assertCanDeleteCustomer(user: SessionUser, companyId: number) {
  if (user.is_admin || user.is_superuser) return
  const positions = await selectMany<{ name: string }>(
    db,
    `SELECT p.name
       FROM users_positions up
       JOIN positions p ON p.id = up.position_id
      WHERE up.user_id = ? AND up.company_id = ?`,
    [user.id, companyId],
  )
  if (positions.some(p => p.name === 'sales_manager')) return
  throw new TypeError('Invalid user permissions')
}

export async function action({ params, request }: ActionFunctionArgs) {
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await assertCanDeleteCustomer(user, user.company_id)
  } catch {
    return redirect(`/login?error=${new TypeError('Invalid user permissions')}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  if (!params.customer) {
    return forceRedirectError(request.headers, 'No customer id provided')
  }
  const customerId = parseInt(params.customer, 10)
  if (!customerId) {
    return { customer_name: undefined }
  }

  const customerRow = await selectId<{ company_id: number }>(
    db,
    'SELECT company_id FROM customers WHERE id = ? AND deleted_at IS NULL',
    customerId,
  )
  if (!customerRow || customerRow.company_id !== user.company_id) {
    return { error: 'Customer not found' }
  }

  const formData = await request.formData()
  const cascadeDeals = formData.get('cascade_deals') === '1'

  const activeDealsRow = await selectId<{ c: number }>(
    db,
    'SELECT COUNT(*) AS c FROM deals WHERE customer_id = ? AND deleted_at IS NULL',
    customerId,
  )
  const activeDeals = activeDealsRow?.c ?? 0
  if (activeDeals > 0 && !cascadeDeals) {
    return { error: 'Confirm removing associated deals' }
  }

  try {
    if (cascadeDeals) {
      await db.execute(
        `UPDATE deals SET deleted_at = NOW() WHERE customer_id = ? AND deleted_at IS NULL`,
        [customerId],
      )
    }
    await db.execute(`UPDATE customers SET deleted_at = NOW() WHERE id = ?`, [
      customerId,
    ])
  } catch (error) {
    posthogClient.captureException(error)
    return { error: 'Failed to delete customer' }
  }

  deleteCustomerFromCloudTalk(customerId).catch(() => undefined)

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Customer deleted'))
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await assertCanDeleteCustomer(user, user.company_id)
  } catch {
    return redirect(`/login?error=${new TypeError('Invalid user permissions')}`)
  }

  const customerId = params.customer ? parseInt(params.customer, 10) : null
  if (!customerId) {
    return { customer_name: undefined, dealCount: 0 }
  }

  const customer = await selectId<{ name: string; company_id: number }>(
    db,
    'SELECT name, company_id FROM customers WHERE id = ? AND deleted_at IS NULL',
    customerId,
  )

  if (!customer || customer.company_id !== user.company_id) {
    return { customer_name: undefined, dealCount: 0 }
  }

  const dealRow = await selectId<{ c: number }>(
    db,
    'SELECT COUNT(*) AS c FROM deals WHERE customer_id = ? AND deleted_at IS NULL',
    customerId,
  )
  const dealCount = dealRow?.c ?? 0

  return {
    customer_name: customer.name,
    dealCount,
  }
}

export default function CustomerDelete() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { customer_name, dealCount } = useLoaderData<typeof loader>()
  const location = useLocation()
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmPending, setConfirmPending] = useState(false)
  const simpleFormRef = useRef<HTMLFormElement>(null)
  const cascadeFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!customer_name) {
      navigate(`..${location.search}`, { replace: true })
    }
  }, [customer_name, navigate, location.search])

  useEffect(() => {
    if (navigation.state === 'idle') {
      setConfirmPending(false)
    }
  }, [navigation.state])

  const closeToList = () => {
    navigate(`..${location.search}`)
  }

  const dialogOpen = Boolean(customer_name)
  const step1Open = dialogOpen && step === 1
  const step2Open = dialogOpen && step === 2 && dealCount > 0
  const isPosting = confirmPending || navigation.state !== 'idle'

  return (
    <>
      <Dialog
        open={step1Open}
        onOpenChange={open => {
          if (!open && !isPosting) closeToList()
        }}
      >
        <DialogContent
          className='sm:max-w-[425px]'
          hideClose={isPosting}
          onPointerDownOutside={e => {
            if (isPosting) e.preventDefault()
          }}
          onEscapeKeyDown={e => {
            if (isPosting) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete customer</DialogTitle>
            <DialogDescription>
              {customer_name
                ? `Are you sure you want to delete ${customer_name}?`
                : 'Customer not found.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              disabled={isPosting}
              onClick={closeToList}
            >
              Cancel
            </Button>
            <LoadingButton
              type='button'
              variant='destructive'
              className='capitalize'
              disabled={!customer_name}
              loading={confirmPending}
              onClick={() => {
                if (!customer_name) return
                if (dealCount > 0) {
                  setStep(2)
                  return
                }
                setConfirmPending(true)
                simpleFormRef.current?.requestSubmit()
              }}
            >
              Confirm
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={step2Open}
        onOpenChange={open => {
          if (!open && !isPosting) closeToList()
        }}
      >
        <DialogContent
          className='sm:max-w-[425px]'
          hideClose={isPosting}
          onPointerDownOutside={e => {
            if (isPosting) e.preventDefault()
          }}
          onEscapeKeyDown={e => {
            if (isPosting) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete customer</DialogTitle>
            <DialogDescription>
              {customer_name
                ? `This customer has ${dealCount} associated deal(s). Remove all deals and delete ${customer_name}?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              disabled={isPosting}
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <LoadingButton
              type='button'
              variant='destructive'
              className='capitalize'
              loading={confirmPending}
              onClick={() => {
                setConfirmPending(true)
                cascadeFormRef.current?.requestSubmit()
              }}
            >
              Confirm
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Form
        ref={simpleFormRef}
        method='post'
        className='fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0 pointer-events-none'
        tabIndex={-1}
        aria-hidden='true'
      >
        <AuthenticityTokenInput />
      </Form>
      <Form
        ref={cascadeFormRef}
        method='post'
        className='fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0 pointer-events-none'
        tabIndex={-1}
        aria-hidden='true'
      >
        <AuthenticityTokenInput />
        <input type='hidden' name='cascade_deals' value='1' />
      </Form>
    </>
  )
}
