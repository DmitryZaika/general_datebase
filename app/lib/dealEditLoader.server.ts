import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import { db } from '~/db.server'
import { fetchNotesWithComments } from '~/lib/noteHelpers.server'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type { Nullable } from '~/types/utils'
import { TERMINAL_LIST_IDS } from '~/utils/constants'
import { selectMany } from '~/utils/queryHelpers'

type UserWithCompany = { company_id: number }

export interface DealEditLoaderData {
  dealId: number
  stages: { id: number; name: string; position: number }[]
  history: { list_id: number; entered_at: string; exited_at: Nullable<string> }[]
  currentListId: number
  isClosed: boolean
  isWon: Nullable<number>
  closedAt: string | null
  activities: DealActivity[]
  notes: DealNote[]
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

      let effectiveGroupId = group_id
      let progressListId = list_id
      if (TERMINAL_LIST_IDS.includes(list_id)) {
        const histGroup = await selectMany<{
          group_id: number
          list_id: number
        }>(
          db,
          `SELECT l.group_id, dsh.list_id FROM deal_stage_history dsh
           JOIN deals_list l ON dsh.list_id = l.id
           WHERE dsh.deal_id = ? AND dsh.list_id NOT IN (?, ?)
           ORDER BY dsh.entered_at DESC LIMIT 1`,
          [dealId, ...TERMINAL_LIST_IDS],
        )
        if (histGroup.length > 0) {
          effectiveGroupId = histGroup[0].group_id
          progressListId = histGroup[0].list_id
        }
      }

      const [stages, history, activities, notes] = await Promise.all([
        selectMany<{ id: number; name: string; position: number }>(
          db,
          'SELECT id, name, position FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position',
          [effectiveGroupId],
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
          `SELECT id, deal_id, company_id, name,
                  DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline,
                  priority, is_completed,
                  DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completed_at,
                  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                  created_by
           FROM deal_activities
           WHERE deal_id = ? AND company_id = ? AND deleted_at IS NULL
           ORDER BY created_at DESC`,
          [dealId, user.company_id],
        ),
        fetchNotesWithComments(db, dealId, user.company_id),
      ])

      const isClosed =
        is_won === 1 || is_won === 0 || TERMINAL_LIST_IDS.includes(list_id)

      let closedAt: string | null = null
      if (isClosed && history.length > 0) {
        const last = history[history.length - 1]
        closedAt = last.exited_at ?? last.entered_at
      }

      return {
        dealId,
        stages,
        history,
        currentListId: progressListId,
        isClosed,
        isWon: is_won,
        closedAt,
        activities,
        notes,
      }
    } catch {
      return redirect('/login')
    }
  }
}
