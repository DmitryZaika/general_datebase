import type { LoaderFunctionArgs } from 'react-router'
import { redirect, useLoaderData } from 'react-router'
import DealPage from '~/components/pages/DealPage'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    const dealId = parseInt(params.dealId || '0', 10)
    if (!dealId) return redirect('/employee/deals')

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

    if (!dealRows.length) return redirect('/employee/deals')

    const { list_id, group_id } = dealRows[0]

    const stages = await selectMany<{
      id: number
      name: string
      position: number
    }>(
      db,
      'SELECT id, name, position FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position',
      [group_id],
    )

    const history = await selectMany<{
      list_id: number
      entered_at: string
      exited_at: string | null
    }>(
      db,
      'SELECT list_id, entered_at, exited_at FROM deal_stage_history WHERE deal_id = ? ORDER BY entered_at',
      [dealId],
    )

    return { stages, history, currentListId: list_id }
  } catch {
    return redirect('/login')
  }
}

export default function DealEditLayout() {
  const { stages, history, currentListId } = useLoaderData<typeof loader>()
  return (
    <DealPage
      stages={stages}
      history={history}
      currentListId={currentListId}
    />
  )
}
