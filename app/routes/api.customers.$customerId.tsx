import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'
import { syncCustomerToCloudTalk } from '~/services/lambda.server'
import type { Customer } from '~/types/customer'
import {
  auditDisplayName,
  fetchUserDisplayNameById,
  normalizeSalesRepId,
  recordCustomerReassignment,
  recordLeadManagerAssignmentBeforeReassign,
} from '~/utils/customerAudit.server'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user: User = await getEmployeeUser(request)
  const customerId = params.customerId

  if (!customerId) {
    posthogClient.captureException(new Error('Customer ID is required'))
    return data({ error: 'Customer ID is required' }, { status: 400 })
  }

  try {
    // Get customer details
    const [customer] = await db.query<(Customer & RowDataPacket)[]>(
      `SELECT c.id, c.name, c.address, c.phone, c.phone_2, c.email, c.company_name, c.source, c.your_message, c.sales_rep, u.name AS sales_rep_name
       FROM customers c
       LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
       WHERE c.id = ? AND c.company_id = ? AND c.deleted_at IS NULL`,
      [customerId, user.company_id],
    )

    if (!customer || customer.length === 0) {
      posthogClient.captureException(new Error('Customer not found'))
      return data({ error: 'Customer not found' }, { status: 404 })
    }

    return data({ customer: customer[0] })
  } catch (error) {
    posthogClient.captureException(error)
    return data({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    )
  }

  const actor = await getEmployeeUser(request)

  const customerId = parseInt(params.customerId || '0')

  const userData = await request.json()
  const validatedData = customerSignupSchema.parse(userData)

  const salesRep =
    validatedData.sales_rep !== undefined && validatedData.sales_rep !== null
      ? validatedData.sales_rep
      : null
  const assignedBy = auditDisplayName(actor)

  const [prevRows] = await db.execute<RowDataPacket[]>(
    'SELECT sales_rep FROM customers WHERE id = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1',
    [customerId, actor.company_id],
  )
  const prevRep = normalizeSalesRepId(prevRows[0]?.sales_rep)
  const nextRep = normalizeSalesRepId(salesRep)
  const repChanged = prevRep !== nextRep

  if (repChanged) {
    await recordLeadManagerAssignmentBeforeReassign(db, customerId, prevRep)
  }

  await db.execute<ResultSetHeader>(
    `UPDATE customers SET name = ?, phone = ?, phone_2 = ?, email = ?, address = ?, your_message = ?, referral_source = ?, source = ?, company_id = ?, company_name = ?, sales_rep = ? WHERE id = ?`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.phone_2 || null,
      validatedData.email || null,
      validatedData.address || null,
      validatedData.your_message || null,
      validatedData.referral_source || null,
      validatedData.source,
      validatedData.company_id,
      validatedData.company_name || null,
      salesRep,
      customerId,
    ],
  )

  if (repChanged) {
    const toName = await fetchUserDisplayNameById(db, salesRep)
    await recordCustomerReassignment(db, customerId, assignedBy, toName)
  }

  if (salesRep !== null) {
    await db.execute(
      'UPDATE deals SET user_id = ? WHERE customer_id = ? AND deleted_at IS NULL',
      [salesRep, customerId],
    )

    const [existingDealRows] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM deals WHERE customer_id = ? AND deleted_at IS NULL LIMIT 1',
      [customerId],
    )

    if (existingDealRows.length === 0) {
      const [defaultListRows] = await db.execute<RowDataPacket[]>(
        `SELECT dl.id, dl.name
         FROM groups_list g
         JOIN deals_list dl ON dl.group_id = g.id AND dl.deleted_at IS NULL
         WHERE g.deleted_at IS NULL AND g.is_default = 1
           AND (g.company_id = ? OR g.id = 1)
         ORDER BY dl.position ASC
         LIMIT 1`,
        [validatedData.company_id],
      )
      const listId = defaultListRows[0]?.id ?? 1
      const status = defaultListRows[0]?.name ?? 'New Customer'
      const [posRows] = await db.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = ? AND deleted_at IS NULL',
        [listId],
      )
      const nextPos = posRows[0]?.next ?? 1
      const [dealResult] = await db.execute<ResultSetHeader>(
        'INSERT INTO deals (customer_id, status, list_id, position, user_id, created_by) VALUES (?,?,?,?,?,?)',
        [customerId, status, listId, nextPos, salesRep, assignedBy],
      )
      await db.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealResult.insertId, listId],
      )
    }
  }

  await syncCustomerToCloudTalk(validatedData.company_id, customerId)

  return data({
    success: true,
    message: 'Customer updated successfully',
  })
}
