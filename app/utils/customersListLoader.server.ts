import { db } from '~/db.server'
import type { sourceEnum } from '~/schemas/customers'
import { selectMany } from '~/utils/queryHelpers'

export type CustomersListCustomer = {
  id: number
  name: string
  phone: string
  phone_2?: string | null
  email: string
  address: string
  sales_rep: number | null
  sales_rep_name: string | null
  created_date: string
  className?: string
  company_id: number
  source: (typeof sourceEnum)[number] | 'user-input'
  invalid_lead: string | null
  revenue_generated?: number | null
  projects_count?: number | null
  company_name?: string | null
}

export type WalkInSalesRepCount = {
  salesRepId: number | null
  salesRepName: string
  count: number
}

export type CustomersListLoaderData = {
  customers: CustomersListCustomer[]
  isAdmin: boolean
  isSalesManager: boolean
  walkInsBySalesRep?: WalkInSalesRepCount[]
}

async function loadWalkInsBySalesRep(
  companyId: number,
): Promise<WalkInSalesRepCount[]> {
  const counts = await selectMany<{
    sales_rep: number | null
    sales_rep_name: string | null
    count: number
  }>(
    db,
    `SELECT c.sales_rep, u.name AS sales_rep_name, COUNT(*) AS count
       FROM customers c
       LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
      WHERE c.deleted_at IS NULL
        AND c.company_id = ?
        AND c.source = 'check-in'
        AND c.sales_rep IS NOT NULL
        AND (c.invalid_lead IS NULL OR c.invalid_lead = '')
        AND YEAR(c.created_date) = YEAR(CURRENT_DATE())
        AND MONTH(c.created_date) = MONTH(CURRENT_DATE())
      GROUP BY c.sales_rep, u.name
      HAVING COUNT(*) > 0`,
    [companyId],
  )

  return counts
    .map(row => ({
      salesRepId: row.sales_rep,
      salesRepName: row.sales_rep_name ?? 'Unknown',
      count: row.count,
    }))
    .sort((a, b) => b.count - a.count || a.salesRepName.localeCompare(b.salesRepName))
}

export async function loadCustomersListPage(
  request: Request,
  user: { id: number; company_id: number; is_admin: boolean },
  options?: { includeWalkInsBySalesRep?: boolean },
): Promise<CustomersListLoaderData> {
  const url = new URL(request.url)
  const salesRepFilter = url.searchParams.get('sales_rep')
  const includeInvalid = url.searchParams.get('show_invalid') === '1'
  const view = url.searchParams.get('view') || 'customers'

  const params: number[] = []
  const conditions: string[] = ['c.deleted_at IS NULL', 'c.company_id = ?']
  params.push(user.company_id)

  if (view === 'companies') {
    conditions.push("(c.company_name IS NOT NULL AND c.company_name != '')")
  }

  if (salesRepFilter) {
    conditions.push('c.sales_rep = ?')
    params.push(Number(salesRepFilter))
  }
  if (!includeInvalid && view !== 'companies') {
    conditions.push("(c.invalid_lead IS NULL OR c.invalid_lead = '')")
  }
  const where = `WHERE ${conditions.join(' AND ')}`

  let query = `
    SELECT c.id, c.name, c.email, c.phone, c.phone_2, c.address, c.sales_rep, c.created_date, u.name AS sales_rep_name, c.company_id, c.source, c.invalid_lead, c.company_name
    FROM customers c
    LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
    ${where}
  `

  if (view === 'companies') {
    query = `
      SELECT 
        c.id, c.name, c.email, c.phone, c.phone_2, c.address, c.sales_rep, c.created_date, 
        u.name AS sales_rep_name, c.company_id, c.source, c.invalid_lead, c.company_name,
        (
          SELECT SUM(s.price)
          FROM sales s
          LEFT JOIN customers sub ON sub.id = s.customer_id
          WHERE s.customer_id = c.id OR sub.parent_id = c.id
        ) as revenue_generated,
        (
          SELECT COUNT(*)
          FROM sales s
          LEFT JOIN customers sub ON sub.id = s.customer_id
          WHERE s.customer_id = c.id OR sub.parent_id = c.id
        ) as projects_count
      FROM customers c
      LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
      ${where}
    `
  }

  const customers = await selectMany<CustomersListCustomer>(db, query, params)

  const positions = await selectMany<{ name: string }>(
    db,
    `SELECT p.name
       FROM users_positions up
       JOIN positions p ON p.id = up.position_id
      WHERE up.user_id = ? AND up.company_id = ?`,
    [user.id, user.company_id],
  )

  const isSalesManager = positions.some(role => role.name === 'sales_manager')

  const processed = customers.map(c => ({
    ...c,
    className:
      c.sales_rep === null
        ? c.invalid_lead && c.invalid_lead !== ''
          ? 'bg-yellow-100'
          : 'bg-red-200'
        : undefined,
  }))
  const walkInsBySalesRep = options?.includeWalkInsBySalesRep
    ? await loadWalkInsBySalesRep(user.company_id)
    : undefined

  return {
    customers: processed,
    isAdmin: user.is_admin,
    isSalesManager,
    walkInsBySalesRep,
  }
}
