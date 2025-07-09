import { type ActionFunctionArgs, redirect, useLocation, useNavigate } from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'

import { Contract } from '~/orm/contract'
import { commitSession, getSession } from '~/sessions'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

export async function action({ params, request }: ActionFunctionArgs) {
  await getEmployeeUser(request)
  if (!params.sale) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const saleId = parseInt(params.sale)
  const contract = await Contract.fromSalesId(saleId)
  await contract.unsell()

  const session = await getSession(request.headers.get('Cookie'))
  session.flash(
    'message',
    toastData('Success', 'Transaction canceled, slabs processed successfully'),
  )
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function SupportsAdd() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Cancel Transaction'
      description={`Are you sure you want to cancel the transaction?`}
    />
  )
}
