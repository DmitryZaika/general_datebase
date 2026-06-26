import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { GPT_MINI_MODEL } from '~/utils/openaiModels'
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
  'Your job is to improve customer-facing business messages at tone level 2 on a 1-3 scale. Level 1 is too plain: only grammar and spelling fixes with almost no word changes. Level 3 is too fancy: stiff, wordy, or corporate. Always write level 2: clear, friendly, professional, and noticeably improved wording. Fix grammar and spelling, and upgrade weak or casual phrasing to slightly better words while keeping the same meaning and a natural voice. You must improve wording, not just proofread. Words like typically, prepare, and please let me know are good level 2 wording. Do not avoid them. Good level 2 upgrades: "you said you\'ll call me" -> "you mentioned you\'ll call me back"; "I wanted to check in" -> "I wanted to follow up"; "let me know if that works" -> "please let me know if that works for you"; "we cut a 30 inch hole" -> "we typically prepare a 30 inch opening for the stove". Do not go to level 3. Avoid stiff phrasing such as "consistently ensures", "please be advised", "identified any factors", "may necessitate", "at your earliest convenience", or adding extra clauses that sound like legal or marketing copy. Keep sentences straightforward. Do not add new facts, promises, dates, prices, or ideas. Keep the same language as the input. Return only the improved text with no explanations or labels. Bad level 3: "Please be advised that we will prepare your opening on schedule, which consistently ensures a proper fit. Kindly inform us if you have identified any factors that may necessitate on-site cutting at your earliest convenience." Good level 2: "We typically prepare a 30 inch opening for the stove, which should give you a proper fit. Please let me know if anything on your end would need cutting on site."'

const EMAIL_SYSTEM_PROMPT = `${SHARED_IMPROVE_RULES} You edit customer-facing business emails. Preserve the original structure, paragraphs, and line breaks when they help readability. Keep a warm, natural tone. If you see the term "wordPress" as a source, replace it with "Web-site".`

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
      model: GPT_MINI_MODEL,
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
