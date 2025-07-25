import { type ActionFunctionArgs, data } from 'react-router'

import { Contract } from '~/orm/contract'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError } from '~/utils/toastHelpers'

export async function action({ params, request }: ActionFunctionArgs) {
  await getEmployeeUser(request)
  if (!params.sale) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }

  const saleId = parseInt(params.sale)
  const contract = await Contract.fromSalesId(saleId)
  await contract.unsell()










  
  return data({
    success: true,
  })
}
