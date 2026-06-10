import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const improveSchema = z.object({
  body: z.string().min(1),
  channel: z.enum(['email', 'sms']).optional().default('email'),
})

const EMAIL_SYSTEM_PROMPT =
  'You are an expert editor for customer-facing business emails. Improve the provided email body text: fix all grammar, spelling, and style issues, make it sound more professional and clear, keep the same language as the input, preserve the original meaning, and do not add new ideas. If you see the term "wordPress" as a source, replace it with "Web-site". Return only the improved email body text without any explanations or labels.'

const SMS_SYSTEM_PROMPT =
  'You proofread SMS text messages. Fix only grammar and spelling mistakes. Do not reformat the message: no line breaks, no paragraph breaks, no splitting at commas. Keep the same sentence order and tone. Keep proper names capitalized. Return one single line of plain text with spaces between sentences. Return only the corrected SMS text, nothing else.'

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to authorize', 401)
  }

  let parsed: z.infer<typeof improveSchema>
  try {
    parsed = improveSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Invalid request data', 400)
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        {
          role: 'system',
          content: parsed.channel === 'sms' ? SMS_SYSTEM_PROMPT : EMAIL_SYSTEM_PROMPT,
        },
        { role: 'user', content: parsed.body },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const rawBody = typeof content === 'string' ? content.trim() : ''
    const body =
      parsed.channel === 'sms' ? rawBody.replace(/\s+/g, ' ').trim() : rawBody

    return new Response(JSON.stringify({ body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to improve email', 500)
  }
}
