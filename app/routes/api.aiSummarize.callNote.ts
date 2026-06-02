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
      messages: [
        {
          role: 'system',
          content: `Summarize this phone sales call into a CRM note for a countertop and stone fabrication company.

Return plain text only. Use one bullet per topic. Every bullet must use the format "- Label: details" with a colon after the label (e.g. "- Project: ...", "- Sink: ..."). The note must be complete—never end mid-sentence or mid-thought.

Include only job-relevant facts. Use plain, direct wording—do not rephrase into formal CRM language. Do not stack synonyms (e.g. avoid "provided by the customer, updated and retained"). Never include customer names, caller names, or other personal names—use "customer" or omit. Location may be city or area only.

Whenever the call states a calendar date, day (today, tomorrow, Monday), or clock time (3 pm, 6:00, this afternoon), include that exact wording in the relevant bullet—never drop or generalize it. Apply this in Project timing, Next steps discussed, and any other bullet where timing was said.

When mentioned, always include these bullets using exactly these labels:
- Project: room/project type, stone or material type (granite, quartz, etc.), approximate dimensions
- Sink: single or double, color if stated, and who provides it for the job (e.g. "customer keeps existing sink" or "company supplies new sink"). Plain words only—do not add retained, updated, upgraded, provided by, or similar unless the call clearly requires it for the quote. Omit sink renovation history or condition
- Backsplash: height and which walls
- Edge profile: flat, rounded, ogee, 1/4 bevel, 1/2 bevel, bullnose, etc.
- Location: city or area only
- Project timing: only the customer's desired start or schedule, quoted exactly as they said it (days, weeks, months). If they give more than one timeframe, list all of them. Do not include company turnaround, lead time, or install timeline—that is already known internally and is not note-worthy when only the salesperson told the customer
- Tear-out: only if removing existing countertops was discussed. Use plain words (remove existing countertops)—not industry jargon the customer did not use or understand. If the customer asked what tear-out means or only agreed after the rep explained, say they agreed to removal when explained; do not write that they requested tear-out. For current top material, include only what the customer confirmed; if they said they do not know the material, write material unknown—never state laminate, stone, or any type the rep guessed or asked about. Pending photos for material identification belongs in Next steps discussed, not as a confirmed material in Tear-out

Do not include plumbing unless the customer asked about it or raised it as part of their project. Omit plumbing when only the salesperson stated company policy. Same rule for company turnaround or standard timelines the salesperson explained to the customer—omit from the note.

You may end with one bullet "Next steps discussed" only for agreements from the call (e.g. send options link, customer sends photos). Include exact timing when stated (today, tomorrow, a little later, 6–8 weeks, etc.). No filler such as "no details discussed".`,
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
