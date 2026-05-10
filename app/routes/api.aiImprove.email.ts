import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { runTask } from '~/lib/ai/runner.server'
import { improveEmailTask } from '~/lib/ai/tasks/improveEmail.task'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const improveSchema = z.object({
  body: z.string().min(1),
})

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function action({ request }: ActionFunctionArgs) {
  let userId: number
  try {
    const user = await getEmployeeUser(request)
    userId = user.id
  } catch (error) {
    posthogClient.captureException(error)
    return errorResponse('Failed to authorize', 401)
  }

  let parsed: z.infer<typeof improveSchema>
  try {
    parsed = improveSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return errorResponse('Invalid request data', 400)
  }

  try {
    const result = await runTask(improveEmailTask, parsed, userId)
    return new Response(JSON.stringify({ body: result.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return errorResponse('Failed to improve email', 500)
  }
}
