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

export type CustomersListLoaderData = {
  customers: CustomersListCustomer[]
  isAdmin: boolean
  isSalesManager: boolean
}

export async function loadCustomersListPage(
  request: Request,
  user: { id: number; company_id: number; is_admin: boolean },
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
  return {
    customers: processed,
    isAdmin: user.is_admin,
    isSalesManager,
  }
}
