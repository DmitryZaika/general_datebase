import { AlertTriangle } from 'lucide-react'
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
import { csrf } from '~/utils/csrf.server'
import { selectId } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const stoneId = parseInt(params.stone, 10)
  if (!stoneId) {
    return { name: undefined }
  }

  const formData = await request.formData()
  const cascadeSlabs = formData.get('cascade_slabs') === '1'

  const activeSlabsRow = await selectId<{ c: number }>(
    db,
    `SELECT COUNT(*) AS c
     FROM slab_inventory
     WHERE stone_id = ? AND deleted_at IS NULL AND cut_date IS NULL`,
    stoneId,
  )
  const slabCount = activeSlabsRow?.c ?? 0
  if (slabCount > 0 && !cascadeSlabs) {
    return { error: 'Confirm removing associated slabs' }
  }

  const slabsResult = await db.execute(
    `SELECT url FROM slab_inventory WHERE stone_id = ? AND url IS NOT NULL`,
    [stoneId],
  )

  const slabs = slabsResult[0] as Array<{ url: string }>
  if (slabs && slabs.length > 0) {
    for (const slab of slabs) {
      if (slab.url) {
        deleteFile(slab.url)
      }
    }
  }

  await db.execute(
    `UPDATE slab_inventory SET deleted_at = CURRENT_TIMESTAMP WHERE stone_id = ?`,
    [stoneId],
  )

  await db.execute(`UPDATE stones SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    stoneId,
  ])

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Stone Deleted'))
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const stoneId = parseInt(params.stone, 10)
  if (!stoneId) {
    return { name: undefined, slabCount: 0 }
  }

  const stone = await selectId<{ name: string }>(
    db,
    'SELECT name FROM stones WHERE id = ? AND deleted_at IS NULL',
    stoneId,
  )

  if (!stone) {
    return { name: undefined, slabCount: 0 }
  }

  const activeSlabsRow = await selectId<{ c: number }>(
    db,
    `SELECT COUNT(*) AS c
     FROM slab_inventory
     WHERE stone_id = ? AND deleted_at IS NULL AND cut_date IS NULL`,
    stoneId,
  )

  return {
    name: stone.name,
    slabCount: activeSlabsRow?.c ?? 0,
  }
}

export default function StoneDelete() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { name, slabCount } = useLoaderData<typeof loader>()
  const location = useLocation()
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmPending, setConfirmPending] = useState(false)
  const simpleFormRef = useRef<HTMLFormElement>(null)
  const cascadeFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!name) {
      navigate(`..${location.search}`, { replace: true })
    }
  }, [name, navigate, location.search])

  useEffect(() => {
    if (navigation.state === 'idle') {
      setConfirmPending(false)
    }
  }, [navigation.state])

  const closeToList = () => {
    navigate(`..${location.search}`)
  }

  const dialogOpen = Boolean(name)
  const step1Open = dialogOpen && step === 1
  const step2Open = dialogOpen && step === 2 && slabCount > 0
  const isPosting = confirmPending || navigation.state !== 'idle'

  return (
    <Dialog open={dialogOpen} onOpenChange={open => !open && closeToList()}>
      <DialogContent className='sm:max-w-[425px]'>
        {step1Open ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete stone</DialogTitle>
              <DialogDescription>
                {name ? `Are you sure you want to delete ${name}?` : 'Stone not found.'}
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
                disabled={!name}
                loading={confirmPending}
                onClick={() => {
                  if (!name) return
                  if (slabCount > 0) {
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
          </>
        ) : null}

        {step2Open ? (
          <>
            <div className='flex justify-center pb-1'>
              <AlertTriangle className='h-10 w-10 text-amber-500' aria-hidden='true' />
            </div>
            <DialogHeader>
              <DialogTitle>Delete stone</DialogTitle>
              <DialogDescription>
                {name
                  ? `This stone has ${slabCount} associated slab(s). The stone and its slabs will be hidden from inventory — nothing is permanently deleted. Continue with ${name}?`
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
          </>
        ) : null}

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
          <input type='hidden' name='cascade_slabs' value='1' />
        </Form>
      </DialogContent>
    </Dialog>
  )
}
