import { data, type LoaderFunctionArgs } from 'react-router'
import { findCustomerDealsForUser } from '~/utils/customerDeals.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const customerEmail = url.searchParams.get('customerEmail')?.trim() ?? ''
  const customerName = url.searchParams.get('customerName')?.trim() ?? ''

  if (!customerEmail && !customerName) {
    return data({ error: 'customerEmail or customerName required' }, { status: 400 })
  }

  const deals = await findCustomerDealsForUser(
    user.id,
    user.company_id,
    customerEmail || undefined,
    customerName || undefined,
  )

  return data({ deals })
}
