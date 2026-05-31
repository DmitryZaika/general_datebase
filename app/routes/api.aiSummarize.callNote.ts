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
})

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
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

  if (countWords(transcript) <= 25) {
    return new Response(JSON.stringify({ content: transcript }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      max_tokens: 40,
      messages: [
        {
          role: 'system',
          content:
            'Turn the call transcript into the shortest possible CRM note. Use the fewest words. State only what was said about the work. Never expand or rephrase into longer sentences. Never mention what was not discussed. Never add filler such as "due to", "no details discussed", or similar padding. No action items or follow-ups. One short sentence. Use the same language as the transcript. Return only the note text.',
        },
        { role: 'user', content: transcript },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const note = typeof content === 'string' ? content.trim() : ''

    if (!note) {
      return createErrorResponse('No work-related content found in transcript', 422)
    }

    return new Response(JSON.stringify({ content: note }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to summarize call', 500)
  }
}
