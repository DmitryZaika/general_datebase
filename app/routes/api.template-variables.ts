import type { LoaderFunctionArgs } from 'react-router'
import { fetchTemplateVariableData } from '~/services/templateVariables.server'
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

  try {
    const data = await fetchTemplateVariableData({
      user,
      dealId: dealId && !Number.isNaN(dealId) ? dealId : undefined,
    })

    return Response.json(data)
  } catch (error) {
    posthogClient.captureException(error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
