import type { LoaderFunctionArgs } from 'react-router'
import { fetchTemplateVariableData } from '~/services/lambda.server'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dealIdParam = url.searchParams.get('dealId')
  const dealId = dealIdParam ? parseInt(dealIdParam, 10) : undefined

  const cleanDealId = dealId && !Number.isNaN(dealId) ? dealId : null
  try {
    const data = await fetchTemplateVariableData(user.id, cleanDealId, null)

    return Response.json(data)
  } catch (error) {
    posthogClient.captureException(error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
