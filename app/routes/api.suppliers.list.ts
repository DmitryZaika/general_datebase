import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import { selectMany } from '~/utils/queryHelpers'
import { getUserBySessionId } from '~/utils/session.server'

interface SupplierListItem {
  id: number
  supplier_name: string
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  if (!activeSession) {
    return Response.json({ suppliers: [] }, { status: 401 })
  }

  const user = (await getUserBySessionId(activeSession)) || null
  if (!user?.company_id) {
    return Response.json({ suppliers: [] }, { status: 401 })
  }

  const url = new URL(request.url)
  const search = url.searchParams.get('q')?.trim() ?? ''

  const suppliers = search
    ? await selectMany<SupplierListItem>(
        db,
        `SELECT id, supplier_name FROM suppliers
         WHERE company_id = ? AND supplier_name LIKE ?
         ORDER BY supplier_name ASC LIMIT 50`,
        [user.company_id, `%${search}%`],
      )
    : await selectMany<SupplierListItem>(
        db,
        `SELECT id, supplier_name FROM suppliers
         WHERE company_id = ?
         ORDER BY supplier_name ASC LIMIT 200`,
        [user.company_id],
      )

  return Response.json({ suppliers })
}
