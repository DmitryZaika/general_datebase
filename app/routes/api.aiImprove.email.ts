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

const SHARED_IMPROVE_RULES =
  'Your job is to polish customer-facing business messages, not just proofread them. Fix grammar and spelling, and upgrade wording so the message sounds more professional, clear, and confident while keeping the same meaning. Prefer stronger, more polished phrasing over casual wording when both say the same thing. Examples: "You said you\'ll call me" -> "You mentioned you\'ll call me back"; "I wanted to check in" -> "I wanted to follow up"; "Let me know if that works" -> "Please let me know if that works for you". Do not add new facts, promises, dates, prices, or ideas. Keep the same language as the input. Return only the improved text with no explanations or labels.'

const EMAIL_SYSTEM_PROMPT = `${SHARED_IMPROVE_RULES} You edit customer-facing business emails. Preserve the original structure, paragraphs, and line breaks when they help readability. Keep a warm, professional tone. If you see the term "wordPress" as a source, replace it with "Web-site".`

const SMS_SYSTEM_PROMPT = `${SHARED_IMPROVE_RULES} You edit SMS text messages. Keep the message concise and natural for texting. Do not add line breaks or paragraph breaks. Return one single line of plain text with spaces between sentences. Keep proper names capitalized.`

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
