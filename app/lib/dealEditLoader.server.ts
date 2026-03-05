import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import { db } from '~/db.server'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { Nullable } from '~/types/utils'
import { selectMany } from '~/utils/queryHelpers'

type UserWithCompany = { company_id: number }

export interface DealEditLoaderData {
  dealId: number
  stages: { id: number; name: string; position: number }[]
  history: { list_id: number; entered_at: string; exited_at: Nullable<string> }[]
  currentListId: number
  activities: DealActivity[]
  isWon: Nullable<number>
}

export function createDealEditLoader(
  getUser: (request: Request) => Promise<UserWithCompany>,
  dealsRedirectPath: string,
) {
  return async function dealEditLoader({ request, params }: LoaderFunctionArgs) {
    try {
      const user = await getUser(request)
      const dealId = parseInt(params.dealId || '0', 10)
      if (!dealId) return redirect(dealsRedirectPath)

      const dealRows = await selectMany<{
        list_id: number
        group_id: number
        is_won: Nullable<number>
      }>(
        db,
        `SELECT d.list_id, l.group_id, d.is_won
         FROM deals d
         JOIN deals_list l ON d.list_id = l.id
         JOIN customers c ON d.customer_id = c.id
         WHERE d.id = ? AND d.deleted_at IS NULL AND c.company_id = ?`,
        [dealId, user.company_id],
      )

      if (!dealRows.length) return redirect(dealsRedirectPath)

      const { list_id, group_id, is_won } = dealRows[0]

      const [stages, history, activities] = await Promise.all([
        selectMany<{ id: number; name: string; position: number }>(
          db,
          'SELECT id, name, position FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position',
          [group_id],
        ),
        selectMany<{
          list_id: number
          entered_at: string
          exited_at: Nullable<string>
        }>(
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

      return {
        dealId,
        stages,
        history,
        currentListId: list_id,
        activities,
        isWon: is_won,
      }
    } catch {
      return redirect('/login')
    }
  }
}
