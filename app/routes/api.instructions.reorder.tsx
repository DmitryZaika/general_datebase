import { type ActionFunctionArgs, data } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { orderedIdsToAfterIds } from '~/utils/instructionTree'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type SessionUser } from '~/utils/session.server'

const reorderSchema = z.object({
  parentId: z.number().nullable(),
  orderedIds: z.array(z.number()).min(1),
  mode: z.enum(['company', 'general']).optional(),
})

export async function action({ request }: ActionFunctionArgs) {
  let user: SessionUser
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return data({ error: String(error) }, { status: 401 })
  }

  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 })
  }

  let payload: z.infer<typeof reorderSchema>
  try {
    payload = reorderSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error, user.id.toString())
    return data({ error: 'Invalid reorder payload' }, { status: 400 })
  }

  const allowGeneral = !!user.is_superuser
  const mode = allowGeneral && payload.mode === 'general' ? 'general' : 'company'
  const companyId = mode === 'general' ? 0 : user.company_id
  const parentId = payload.parentId

  const siblings = await selectMany<{ id: number }>(
    db,
    `SELECT id FROM instructions
     WHERE company_id = ?
       AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)`,
    [companyId, parentId, parentId],
  )

  const siblingIds = new Set(siblings.map(row => row.id))
  const orderedSet = new Set(payload.orderedIds)

  if (orderedSet.size !== payload.orderedIds.length) {
    return data({ error: 'Duplicate instruction ids in order' }, { status: 400 })
  }

  if (orderedSet.size !== siblingIds.size) {
    return data(
      { error: 'Instruction order must include all siblings' },
      { status: 400 },
    )
  }

  for (const id of payload.orderedIds) {
    if (!siblingIds.has(id)) {
      return data({ error: 'Invalid instruction id for this parent' }, { status: 400 })
    }
  }

  const updates = orderedIdsToAfterIds(payload.orderedIds)

  try {
    for (const update of updates) {
      await db.execute(
        `UPDATE instructions SET after_id = ?
         WHERE id = ? AND company_id = ?
           AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)`,
        [update.after_id, update.id, companyId, parentId, parentId],
      )
    }

    return data({ success: true })
  } catch (error) {
    posthogClient.captureException(error, user.id.toString())
    return data({ error: 'Failed to update instruction order' }, { status: 500 })
  }
}
