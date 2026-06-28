import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { z } from 'zod'
import { replaceTemplateVariables } from '~/services/lambda.server'
import { getEmployeeUser } from '~/utils/session.server'

// 1. Define a bulletproof Zod schema
const replaceTemplateSchema = z.object({
  userId: z.coerce.number(),
  dealId: z.preprocess(
    val => (val === '' || val === undefined || val === null ? null : val),
    z.coerce.number().nullable(),
  ),
  customerId: z.preprocess(
    val => (val === '' || val === undefined || val === null ? null : val),
    z.coerce.number().nullable(),
  ),
  template: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  const user = await getEmployeeUser(request)
  if (request.method !== 'POST') {
    return data({ success: false, error: 'Method Not Allowed' }, { status: 405 })
  }

  try {
    const rawData = await request.json()

    // 3. Validate data with Zod
    const result = replaceTemplateSchema.safeParse(rawData)

    if (!result.success) {
      // Return flat, scannable field errors to the frontend
      return data(
        { success: false, errors: z.treeifyError(result.error) },
        { status: 400 },
      )
    }

    // 4. Call your original function with clean, typed arguments
    const { userId, dealId, customerId, template } = result.data
    const completedTemplate = await replaceTemplateVariables(
      userId,
      dealId,
      user.company_id,
      customerId,
      template,
    )

    // 5. Send back the victory lap
    return data({ success: true, result: completedTemplate })
  } catch (error) {
    return data(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    )
  }
}
