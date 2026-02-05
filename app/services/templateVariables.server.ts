import type { RowDataPacket } from 'mysql2'
import { db } from '~/db.server'
import type { TemplateVariableData } from '~/utils/emailTemplateVariables'

interface UserData {
  id: number
  name?: string | null
  email?: string
  phone_number?: string
  company_id?: number
}

interface FetchTemplateVariableDataParams {
  user: UserData
  dealId?: number
  customerId?: number
}

export async function fetchTemplateVariableData({
  user,
  dealId,
  customerId,
}: FetchTemplateVariableDataParams): Promise<TemplateVariableData> {
  const [customerData, companyData] = await Promise.all([
    fetchCustomerData(dealId, customerId),
    fetchCompanyData(user.company_id),
  ])

  return {
    user: {
      name: user.name || undefined,
      email: user.email || undefined,
      phone_number: user.phone_number || undefined,
    },
    customer: customerData,
    company: companyData,
  }
}

async function fetchCustomerData(
  dealId?: number,
  customerId?: number,
): Promise<TemplateVariableData['customer']> {
  if (!dealId && !customerId) {
    return undefined
  }

  if (dealId) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.name, c.address
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [dealId],
    )

    if (rows?.[0]) {
      return {
        name: rows[0].name || undefined,
        address: rows[0].address || undefined,
      }
    }
  }

  if (customerId) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT name, address FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [customerId],
    )

    if (rows?.[0]) {
      return {
        name: rows[0].name || undefined,
        address: rows[0].address || undefined,
      }
    }
  }

  return undefined
}

async function fetchCompanyData(
  companyId?: number,
): Promise<TemplateVariableData['company']> {
  if (!companyId) {
    return undefined
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT name, address FROM company WHERE id = ?',
    [companyId],
  )

  if (rows?.[0]) {
    return {
      name: rows[0].name || undefined,
      address: rows[0].address || undefined,
    }
  }

  return undefined
}
