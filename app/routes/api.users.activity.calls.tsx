import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import type { Calls200Response } from '~/utils/cloudtalk.server'
import { fetchValue } from '~/utils/cloudtalk.server'
import { selectMany } from '~/utils/queryHelpers'

const PARALLEL_PAGES = 5

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const companyId = Number(url.searchParams.get('companyId'))
  const userIds = url.searchParams.getAll('userId').map(Number).filter(Boolean)

  if (!companyId || userIds.length === 0) {
    return Response.json({ activities: [] })
  }

  const reps = await selectMany<{
    id: number
    name: string
    cloudtalk_agent_id: string | null
  }>(
    db,
    `SELECT u.id, u.name, u.cloudtalk_agent_id
      FROM users u
      WHERE u.id IN (${userIds.map(() => '?').join(',')})
        AND u.is_deleted = 0
        AND u.company_id = ?`,
    [...userIds, companyId],
  )

  const userByAgentId: Record<string, { id: number; name: string }> = {}
  const agentIds: string[] = []
  for (const rep of reps) {
    if (rep.cloudtalk_agent_id) {
      agentIds.push(rep.cloudtalk_agent_id)
      userByAgentId[rep.cloudtalk_agent_id] = { id: rep.id, name: rep.name }
    }
  }

  if (agentIds.length === 0) {
    return Response.json({ activities: [] })
  }

  const callItems: Calls200Response[] = []
  const dateFrom = new Date()
  dateFrom.setMonth(dateFrom.getMonth() - 6)
  const dateFromStr = dateFrom.toISOString().split('T')[0]

  const pages: number[][] = []
  for (let i = 0; i < 30; i += PARALLEL_PAGES) {
    pages.push(Array.from({ length: PARALLEL_PAGES }, (_, j) => i + j + 1))
  }

  for (const pageBatch of pages) {
    const results = await Promise.all(
      pageBatch.map(page =>
        fetchValue<Calls200Response>('calls/index.json', companyId, {
          limit: 200,
          pageNumber: page,
          date_from: dateFromStr,
        }).catch(() => ({ items: [] as Calls200Response[] })),
      ),
    )

    let hasMore = true
    for (const result of results) {
      callItems.push(...result.items)
      if (result.items.length < 200) {
        hasMore = false
      }
    }
    if (!hasMore) break
  }

  const activities = callItems
    .filter(item => {
      const agent = item.Cdr.user_id
      return agent !== undefined && userByAgentId[agent] !== undefined
    })
    .map(item => {
      const mappedUser = userByAgentId[item.Cdr.user_id]
      const contactName = item.Contact?.name?.trim()
      return {
        id: Number(item.Cdr.id),
        source: 'cloudtalk_call' as const,
        user_id: mappedUser.id,
        user_name: mappedUser.name,
        action: 'Made a call' as const,
        created_at: item.Cdr.started_at,
        customer_name: contactName && contactName.length > 0 ? contactName : null,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return Response.json({ activities })
}
