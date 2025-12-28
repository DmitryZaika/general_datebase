import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const improveSchema = z.object({
  body: z.string().min(1),
})

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch {
    return createErrorResponse('Failed to authorize', 401)
  }

  let parsed: z.infer<typeof improveSchema>
  try {
    parsed = improveSchema.parse(await request.json())
  } catch {
    return createErrorResponse('Invalid request data', 400)
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert editor for customer-facing business emails. Improve the provided email body text: fix all grammar, spelling, and style issues, make it sound more professional and clear, keep the same language as the input, preserve the original meaning, and do not add new ideas. If you see the term "wordPress" as a source, replace it with "Web-site". Return only the improved email body text without any explanations or labels.',
        },
        { role: 'user', content: parsed.body },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const body = typeof content === 'string' ? content.trim() : ''

    return new Response(JSON.stringify({ body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return createErrorResponse('Failed to improve email', 500)
  }
}
