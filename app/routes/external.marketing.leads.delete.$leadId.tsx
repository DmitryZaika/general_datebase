import { type ActionFunctionArgs, redirect, useNavigate } from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

export async function action({ params, request }: ActionFunctionArgs) {
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
  if (!params.leadId) {
    return forceRedirectError(request.headers, 'No lead id provided')
  }
  const leadId = parseInt(params.leadId)
  if (!leadId) {
    return { lead_name: undefined }
  }

  try {
    await db.execute(`DELETE FROM customers WHERE id = ?`, [leadId])
  } catch {
    return { error: 'Failed to delete lead' }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Lead deleted'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function DeleteLead() {
  const navigate = useNavigate()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete lead'
      description={`Are you sure you want to delete this lead?`}
    />
  )
}
