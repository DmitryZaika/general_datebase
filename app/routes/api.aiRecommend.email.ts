import OpenAI from 'openai'
import { type ActionFunctionArgs, data } from 'react-router'
import { z } from 'zod'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const generateSchema = z.object({
  type: z.enum(['first-contact', 'follow-up', 'reply', 'promotional']),
  userInfo: z.any(),
  extraInfo: z.any(),
})
export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch {
    return data({ error: 'Failed to authorize' }, { status: 400 })
  }

  const requestData = await request.json()
  const cleanData = generateSchema.parse(requestData)

  const response = await client.responses.create({
    model: 'gpt-4o',
    instructions: 'You are a coding assistant that talks like a pirate',
    input: 'Are semicolons optional in JavaScript?',
  })

  return data({
    success: true,
    output: response.output_text,
  })
}
