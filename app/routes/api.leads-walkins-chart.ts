import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { getAdminUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    const url = new URL(request.url)
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')

    let whereClause = 'WHERE c.company_id = ?'
    const params: (string | number)[] = [user.company_id]

    if (fromDate) {
      whereClause += ' AND DATE(c.created_date) >= ?'
      params.push(fromDate)
    }

    if (toDate) {
      whereClause += ' AND DATE(c.created_date) <= ?'
      params.push(toDate)
    }

    const [chartData] = await db.query<ResultSetHeader[] | RowDataPacket[]>(
      `SELECT 
        DATE(c.created_date) as date,
        DAYNAME(c.created_date) as day_name,
        SUM(CASE WHEN c.source = 'leads' THEN 1 ELSE 0 END) as leads,
        SUM(CASE WHEN c.source = 'check-in' THEN 1 ELSE 0 END) as walkins
       FROM customers c
       ${whereClause}
       GROUP BY DATE(c.created_date)
       HAVING leads > 0 OR walkins > 0
       ORDER BY DATE(c.created_date) ASC`,
      params,
    )

    return data({ chartData })
  } catch (error) {
    console.error('Error fetching leads/walk-ins chart data:', error)
    return data({ chartData: [] })
  }
}
