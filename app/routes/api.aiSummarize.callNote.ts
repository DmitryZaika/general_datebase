import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import {
  countWords,
  isVoicemailGreetingOnly,
  resolveIsVoicemail,
  sanitizeCallNoteContent,
  VOICEMAIL_NO_ANSWER_NOTE,
} from '~/lib/callAiHelpers'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const summarizeSchema = z.object({
  transcript: z.string().min(1),
  isVoicemail: z.boolean().optional(),
})

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const VOICEMAIL_NOTE_SYSTEM = `Summarize this outbound sales voicemail into a minimal CRM note for a countertop company.

Return plain text only. Use "- Label: details" bullets. Do not include Voicemail, Call type, or Customer bullets. Maximum 2 bullets.

Required:
- Action: One line combining (a) why the rep called and (b) any prior timing they mention from an older conversation — use a semicolon between them (~18 words total). Example: "Follow-up on inquiry ~5–6 months ago; prior note: ready in May". Never use a separate Previously or Project timing bullet.

Rules:
- Prior customer timing the rep recalls belongs inside Action after a semicolon, not its own bullet.
- Never imply the customer spoke on this voicemail unless they did.
- Never quote, copy, or paraphrase the transcript as prose — output only the bullet lines.
- No filler. Never include personal names.`

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

  const isVoicemail = resolveIsVoicemail(parsed.isVoicemail === true, transcript)

  if (isVoicemail && isVoicemailGreetingOnly(transcript)) {
    return new Response(JSON.stringify({ content: VOICEMAIL_NO_ANSWER_NOTE }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isVoicemail && countWords(transcript) <= 25) {
    const content = sanitizeCallNoteContent(transcript, false, transcript)
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const systemContent = isVoicemail
      ? VOICEMAIL_NOTE_SYSTEM
      : `Summarize this phone sales call into a CRM note for a countertop and stone fabrication company.

Return plain text only. Use one bullet per topic. Every bullet must use the format "- Label: details" with a colon after the label (e.g. "- Project: ...", "- Sink: ..."). The note must be complete—never end mid-sentence or mid-thought.

Include only job-relevant facts. Use plain, direct wording—do not rephrase into formal CRM language. Do not stack synonyms (e.g. avoid "provided by the customer, updated and retained"). Never include customer names, caller names, or other personal names. Do not add Customer or Call type bullets.

Omit any bullet when the topic was not discussed or the value would be unknown—never write "not specified", "unknown", "N/A", "no specific profile mentioned", or any placeholder saying something was not mentioned or not discussed.

Whenever the call states a calendar date, day (today, tomorrow, Monday), or clock time (3 pm, 6:00, this afternoon), include that exact wording in the relevant bullet—never drop or generalize it.

When mentioned, include these bullets using exactly these labels (skip any label with nothing concrete to say):
- Project: room/project type, stone or material type (granite, quartz, etc.), approximate dimensions
- Sink: single or double, color if stated, who provides it for the job, and where it is when stated (e.g. in L-shaped section). Plain words only—do not add retained, updated, upgraded, provided by, or similar unless the call clearly requires it for the quote. Never add negations or clarifications about where the sink is not (e.g. do not write "not in the island"). Omit sink renovation history or condition
- Backsplash: height and which walls
- Edge profile: flat, rounded, ogee, 1/4 bevel, 1/2 bevel, bullnose, etc.—omit this bullet entirely if edge profile was not discussed
- Location: full street address when the customer gave one (street number, street name, city, state); otherwise city or area only—omit this bullet entirely if no place was mentioned. Include Location at most once—never duplicate this bullet
- Budget: customer's stated budget or price target with the exact dollar amount when mentioned (e.g. "$8,000 for quartz and installation")
- Estimate: on-site visit scheduling only—when the salesperson will go to the customer's location to measure or give an estimate, with an agreed day and clock time. Never use Estimate for phone callbacks, quote follow-up calls, material lead times, cabinet timelines, or days the rep will call the customer. Never use Estimate when the customer only asked for an on-site estimate but no appointment day or time was agreed. Never use Estimate for company process the salesperson explained to the customer—omit lead times, how far out you are, when to call to schedule template, measurement-to-install workflow, and advising the customer to call in advance. When the salesperson says "give me a call" or "call in advance", the customer should call the company—never write salesperson will call the customer. If an appointment was missed or rescheduled, state who missed it from the call—if the salesperson apologized, said they missed it, or called it their mistake, write salesperson missed [day/time] appointment, never customer missed. Example: salesperson missed Saturday 10:30 appointment; rescheduled for today at 5:30 pm
- Project timing: only what the customer said about their project status or when they might proceed (project on hold or resuming, waiting on cabinets or other trades, litigation, permits, ready to start, comparison shopping at other suppliers, expired quote needing refresh, material order lead times such as 6–12 weeks)—not on-site estimate appointments, not phone callback scheduling, and not company process the salesperson explained. If the customer is waiting on something, state that. If the customer will contact the company when ready, write that explicitly—do not rephrase as the customer agreeing to the rep's two-or-three-week callback window. When the customer says "call me [day]" or "you can call me", they want the salesperson to call them—never write customer will call for that agreement
- Tear-out: only if removing existing countertops was discussed. Always state who will remove them and the confirmed existing material type (e.g. company removes existing granite countertops, customer removes existing granite countertops). If the customer wants the company to do removal, write company removes existing [material] countertops. If the customer will remove themselves, write customer removes existing [material] countertops. For current top material, include only what the customer confirmed; if they do not know the material, write material unknown—never state a material type the rep guessed or asked about. Never put send photos, links, quotes, or callbacks in Tear-out.

Do not include plumbing unless the customer asked about it or raised it as part of their project. Omit plumbing when only the salesperson stated company policy. Omit company turnaround, lead times, template scheduling workflow, and any other standard process the salesperson explained—the rep already knows this. Only keep what the customer said about their project needs, materials, timing, and preferences.

Never include a Next steps discussed bullet or any task list (send link, send photos, quotes, callbacks, follow-ups, website, inventory, or agreed call-back dates). Notes are job facts only—tasks are handled separately as CRM activities. No filler such as "no details discussed".`

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: transcript },
      ],
      ...(isVoicemail ? { max_tokens: 180 } : {}),
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const note = typeof content === 'string' ? content.trim() : ''

    if (!note) {
      return createErrorResponse('No work-related content found in transcript', 422)
    }

    return new Response(
      JSON.stringify({
        content: sanitizeCallNoteContent(note, isVoicemail, transcript),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to summarize call', 500)
  }
}
