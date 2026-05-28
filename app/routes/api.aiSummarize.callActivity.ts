import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const summarizeSchema = z.object({
  transcript: z.string().min(1),
  callStartedAt: z.string().optional(),
})

const activityResultSchema = z.object({
  name: z.string().optional(),
  deadline: z.string().nullable().optional(),
})

const DEFAULT_ACTIVITY_NAME = 'Follow-up'

function resolveActivityName(name: string | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? trimmed : DEFAULT_ACTIVITY_NAME
}

function resolveActivityDeadline(deadline: string | null | undefined): string | null {
  if (!deadline || typeof deadline !== 'string') return null
  const trimmed = deadline.trim()
  return trimmed ? trimmed : null
}

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

  let parsed: z.infer<typeof summarizeSchema>
  try {
    parsed = summarizeSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Invalid request data', 400)
  }

  const transcript = parsed.transcript.trim()
  if (!transcript) {
    return createErrorResponse('Transcript is empty', 400)
  }

  const callReference = parsed.callStartedAt?.trim()
    ? `Call date/time for relative deadlines: ${parsed.callStartedAt.trim()}`
    : 'No call date provided. Use only explicit dates from the transcript.'

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      response_format: { type: 'json_object' },
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `Extract the primary follow-up action from a phone call transcript for a CRM to-do.

Return JSON only: {"name": string, "deadline": string | null}

Rules for name:
- Short imperative title, usually 2-6 words
- Include the time in the name only when a specific time was committed
- Examples: "Call customer at 5pm", "Make quote", "Send contract", "Schedule measurement", "Email pricing", "Follow up on backsplash", "Prepare estimate", "Visit job site"

Rules for deadline:
- ISO 8601 datetime when a specific date or time was committed
- Date only as YYYY-MM-DD when only a day was mentioned without a time
- null when no date or time was mentioned
- Resolve relative phrases like today, tomorrow, next Monday, end of day, this Friday using the call date below

Examples:
- "I'll call you back at 5pm" -> {"name":"Call customer at 5pm","deadline":"2026-05-27T17:00:00"}
- "I'll send the quote tomorrow morning" -> {"name":"Send quote","deadline":"2026-05-28T09:00:00"}
- "I'll prepare a quote for you" -> {"name":"Make quote","deadline":null}
- "Let's schedule measurement next Tuesday" -> {"name":"Schedule measurement","deadline":"2026-06-03"}
- "I'll email the pricing today" -> {"name":"Email pricing","deadline":"2026-05-27T17:00:00"}
- "We need to follow up on the countertop color" -> {"name":"Follow up on countertop color","deadline":null}
- "Mr. James Milliken is not available" -> {"name":"","deadline":null}
- "No answer, left voicemail" -> {"name":"","deadline":null}

If there is no specific commitment, return {"name":"","deadline":null}. The system will create a generic follow-up without a date.
${callReference}`,
        },
        { role: 'user', content: transcript },
      ],
    })

    const rawContent = completion.choices[0]?.message?.content ?? '{}'
    let json: unknown
    try {
      json = JSON.parse(rawContent)
    } catch (error) {
      posthogClient.captureException(error)
      return createErrorResponse('Failed to parse activity response', 500)
    }

    const result = activityResultSchema.safeParse(json)
    if (!result.success) {
      return new Response(
        JSON.stringify({ name: DEFAULT_ACTIVITY_NAME, deadline: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const name = resolveActivityName(result.data.name)
    const deadline = resolveActivityDeadline(result.data.deadline)

    return new Response(JSON.stringify({ name, deadline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to extract activity', 500)
  }
}
