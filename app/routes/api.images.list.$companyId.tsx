import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface ImageListItem {
  id: number
  name: string
  url: string | null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const companyId = Number(params.companyId)
    if (Number.isNaN(companyId) || companyId < 0 || user.company_id !== companyId) {
      return Response.json({ images: [] })
    }
    const url = new URL(request.url)
    const nameParam = url.searchParams.get('name')?.trim() ?? ''
    const hasSearch = nameParam.length > 0

    const query = hasSearch
      ? `SELECT id, name, url FROM images WHERE company_id = ? AND name LIKE ? ORDER BY name ASC LIMIT 200`
      : `SELECT id, name, url FROM images WHERE company_id = ? ORDER BY name ASC LIMIT 200`
    const queryParams = hasSearch ? [companyId, `%${nameParam}%`] : [companyId]

    const images = await selectMany<ImageListItem>(db, query, queryParams)
    return Response.json({ images })
  } catch {
    return Response.json({ images: [] })
  }
}
