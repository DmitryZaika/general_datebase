import type { LoaderFunctionArgs } from 'react-router'
import { redirect, useLoaderData } from 'react-router'
import DealPage from '~/components/pages/DealPage'
import { db } from '~/db.server'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { Nullable } from '~/types/utils'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    const dealId = parseInt(params.dealId || '0', 10)
    if (!dealId) return redirect('/admin/deals')

    const dealRows = await selectMany<{
      list_id: number
      group_id: number
    }>(
      db,
      `SELECT d.list_id, l.group_id
       FROM deals d
       JOIN deals_list l ON d.list_id = l.id
       JOIN customers c ON d.customer_id = c.id
       WHERE d.id = ? AND d.deleted_at IS NULL AND c.company_id = ?`,
      [dealId, user.company_id],
    )

    if (!dealRows.length) return redirect('/admin/deals')

    const { list_id, group_id } = dealRows[0]

    const [stages, history, activities] = await Promise.all([
      selectMany<{ id: number; name: string; position: number }>(
        db,
        'SELECT id, name, position FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position',
        [group_id],
      ),
      selectMany<{ list_id: number; entered_at: string; exited_at: Nullable<string> }>(
        db,
        'SELECT list_id, entered_at, exited_at FROM deal_stage_history WHERE deal_id = ? ORDER BY entered_at',
        [dealId],
      ),
      selectMany<DealActivity>(
        db,
        `SELECT id, deal_id, company_id, name, deadline, priority, is_completed, completed_at, created_at
         FROM deal_activities
         WHERE deal_id = ? AND company_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [dealId, user.company_id],
      ),
    ])

    return { dealId, stages, history, currentListId: list_id, activities }
  } catch {
    return redirect('/login')
  }
}

export default function AdminDealEditLayout() {
  const { dealId, stages, history, currentListId, activities } =
    useLoaderData<typeof loader>()
  return (
    <DealPage
      dealId={dealId}
      stages={stages}
      history={history}
      currentListId={currentListId}
      activities={activities}
    />
  )
}
