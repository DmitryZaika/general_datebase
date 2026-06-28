import { data, type LoaderFunctionArgs } from 'react-router'
import { findCustomerDealsForUser } from '~/utils/customerDeals.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const customerEmail = url.searchParams.get('customerEmail')?.trim() ?? ''
  const customerName = url.searchParams.get('customerName')?.trim() ?? ''
  const customerId = Number.parseInt(url.searchParams.get('customerId') ?? '', 10)

  if (!customerEmail && !customerName && !Number.isFinite(customerId)) {
    return data(
      { error: 'customerEmail, customerName, or customerId required' },
      { status: 400 },
    )
  }

  const deals = await findCustomerDealsForUser(
    user.id,
    user.company_id,
    customerEmail || undefined,
    customerName || undefined,
    Number.isFinite(customerId) && customerId > 0 ? customerId : undefined,
  )

  return data({ deals })
}
