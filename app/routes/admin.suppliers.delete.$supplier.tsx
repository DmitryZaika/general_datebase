import { type ActionFunctionArgs, redirect, useNavigate } from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'

import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

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
  if (!params.supplier) {
    return forceRedirectError(request.headers, 'No document id provided')
  }
  const supplierId = parseInt(params.supplier)
  if (!supplierId) {
    return { supplier_name: undefined }
  }

  try {
    await db.execute(`DELETE FROM suppliers WHERE id = ?`, [supplierId])
  } catch (error) {
    console.error('Error connecting to the database: ', error)
    return { error: 'Failed to delete supplier' }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Supplier deleted'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function SuppliersAdd() {
  const navigate = useNavigate()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete supplier'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
