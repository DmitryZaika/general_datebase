import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (_error) {
    return data({ error: 'Unauthorized' }, { status: 401 })
  }
  const customerId = Number(params.customerId)
  if (!customerId) return data({ count: 0 })
  const row = await selectId<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM deals WHERE customer_id = ? AND deleted_at IS NULL',
    customerId,
  )
  return data({ count: row?.count ?? 0 })
}
