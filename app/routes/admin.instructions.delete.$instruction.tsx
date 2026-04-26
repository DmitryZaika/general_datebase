import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
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
  const instructionId = params.instruction
  await db.execute(`DELETE FROM instructions WHERE id = ?`, [instructionId])
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'instruction Deleted'))

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const redirectUrl = type ? `..?type=${type}` : '..'

  return redirect(redirectUrl, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.instruction) {
    return forceRedirectError(request.headers, 'No instruction id provided')
  }
  const instructionId = parseInt(params.instruction)

  const instruction = await selectId<{ title: string }>(
    db,
    'select title from instructions WHERE id = ?',
    instructionId,
  )
  return {
    title: instruction?.title,
  }
}

export default function InstructionsDelete() {
  const navigate = useNavigate()
  const { title } = useLoaderData<typeof loader>()
  const url = new URL(typeof window !== 'undefined' ? window.location.href : '')
  const type = url.searchParams.get('type')

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(type ? `..?type=${type}` : '..')
    }
  }
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Delete Instruction</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {title}?
          </DialogDescription>
        </DialogHeader>
        <Form id='customerForm' method='post'>
          <input
            type='text'
            name='_hidden_focus_trick'
            className='absolute left-[-9999px]'
          />
          <DialogFooter>
            <AuthenticityTokenInput />
            <Button type='submit' autoFocus>
              Delete Instruction
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
