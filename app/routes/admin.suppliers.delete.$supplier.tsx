import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from 'react-router'
import { useLoaderData, useNavigate } from 'react-router'
import { selectId } from '~/utils/queryHelpers'
import { DeleteRow } from '~/components/pages/DeleteRow'

import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { getAdminUser } from '~/utils/session.server'
import { csrf } from '~/utils/csrf.server'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch (error) {
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
    await db.execute(`DELETE FROM main.suppliers WHERE id = ?`, [supplierId])
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

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const supplierId = params.supplier ? parseInt(params.supplier, 10) : null
  if (!supplierId) {
    return { supplier_name: undefined }
  }

  const supplier = await selectId<{ supplier_name: string }>(
    db,
    'select supplier_name from suppliers WHERE id = ?',
    supplierId,
  )

  if (!supplier) {
    return { supplier_name: undefined }
  }

  return {
    supplier_name: supplier ? supplier.supplier_name : undefined,
  }
}

export default function SuppliersAdd() {
  const navigate = useNavigate()
  const { supplier_name } = useLoaderData<typeof loader>()

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
