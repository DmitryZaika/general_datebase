import type { RowDataPacket } from 'mysql2'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getEmployeeUser(request)
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.city, c.state, c.postal_code, c.company_id, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose, c.improve_offer, c.sink,
            c.when_start, c.details, c.compaign_name, c.adset_name, c.ad_name
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND c.company_id = ?`,
    [dealId, user.company_id],
  )
  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }
  return { customer: rows[0] }
}

export default function DealProjectInfo() {
  const { customer } = useLoaderData<typeof loader>()
  return (
    <div>
      {Object.entries(customer)
        .filter(([k, v]) => v != null && !['id', 'company_id'].includes(k))
        .map(([k, v]) => (
          <p key={k}>
            Customer {k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase())}:{' '}
            {String(v)}
          </p>
        ))}
    </div>
  )
}
