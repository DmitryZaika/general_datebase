// Refactored, modular, and well‑commented implementation

import type { RowDataPacket } from 'mysql2'
import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

// ============================================================================
// OPENAI CLIENT
// ============================================================================

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

// ============================================================================
// TYPES
// ============================================================================

/** Basic lead details used within prompt construction */
interface LeadInfo {
  leadMessage?: string
  remodelType?: string
  referralSource?: string
  customerName?: string
  customerCompany?: string // <-- NEW
}

/** Lightweight user info parsed from full User object */
interface UserInfo {
  name: string
  company?: string
  phone?: string
  email?: string
  position?: string
}

interface EmailHistoryItem {
  body: string
  sentAt: string
  isFromCustomer?: boolean
}

/** Extract only the fields you want to expose to the prompt builder */
async function getUserInfo(user: {
  name: string
  company_id?: number
  phone_number?: string
  email?: string
  position_id?: number
}): Promise<UserInfo> {
  let companyName: string | undefined
  let positionName: string | undefined

  if (user.company_id !== undefined) {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT name FROM company WHERE id = ? LIMIT 1`,
        [user.company_id],
      )
      if (rows?.length) {
        companyName = rows[0].name
      }
    } catch (err) {
      posthogClient.captureException(err)
    }
  }

  if (user.position_id) {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT name FROM positions WHERE id = ? LIMIT 1`,
        [user.position_id],
      )
      if (rows?.length) {
        positionName = rows[0].name
      }
    } catch (err) {
      posthogClient.captureException(err)
    }
  }

  return {
    name: user.name,
    company: companyName,
    phone: user.phone_number,
    email: user.email,
    position: positionName,
  }
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const generateSchema = z.object({
  emailCategory: z.enum([
    'first-contact',
    'follow-up',
    'reply',
    'promotional',
    'thank-you',
    'feedback-request',
    'referral',
  ]),
  dealId: z.number().optional(),
  threadId: z.uuid().optional(),
  formality: z.enum(['formal', 'neutral', 'casual']).optional(),
  tone: z.enum(['friendly', 'persuasive', 'empathetic', 'urgent']).optional(),
  verboseness: z.enum(['concise', 'detailed']).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  desiredContent: z.string().optional(),
  subject: z.string().optional(),
  variationToken: z.string().optional(),
  skipHistory: z.boolean().optional(),
})

type EmailGenerationParams = z.infer<typeof generateSchema>

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `
  You are an expert sales email assistant. Your purpose is to generate professional, persuasive, and realistically usable emails.

  *** STRICT NEGATIVE CONSTRAINTS ***
  1. NO SIGNATURES: Do NOT include "Best", "Sincerely", "Regards", "Cheers".
  2. NO NAME AT THE END: Do NOT put the sender's name (e.g. "Dema") or company at the end of the email.
  3. NO PLACEHOLDERS: Do not use [brackets].
  4. NO META-TAGS: Do not print "[End of text]".

  *** ENDING RULES (CRITICAL) ***
  • The application adds the signature automatically.
  • If you write the name at the end, it will appear TWICE.
  • STOP writing immediately after the last punctuation mark (usually a question mark).
  • WRONG: "...let me know. Thanks, Dema."
  • CORRECT: "...let me know?"

  *** HUMAN-LIKE & NATURAL FLOW ***
  • Be conversational. Write like a human responding to a friend or colleague.
  • INTELLIGENT RESPONSIVENESS: If the customer asked for a specific action (e.g., "come give a quote"), ADDRESS THAT REQUEST DIRECTLY.
  • If the source is "Facebook" or "Instagram", phrase it casually.

  SUBJECT LINE RULES:
  • Style: Casual, short (2-5 words), sentence case. No "salesy" words.

  EMAIL CATEGORY DEFINITIONS
  (Keep your existing category definitions here...)

  FIRST-CONTACT
  Tone: warm and helpful.
  Structure:
  1. Casual opening ("Hi [Name], this is [Sender] with [Company]").
  2. Acknowledge intent / Analyze request.
  3. End with a specific question.
  
  GENERAL RULES
  • PHONE/EMAIL RULES:
    - FIRST-CONTACT: NEVER include phone/email in body.
    - REPLY: Include phone ONLY if asked.
  
  *** OUTPUT STRUCTURE ***
  1. Provide ONLY the subject line (no "Subject:" prefix).
  2. Next line: ---BODY---
  3. Then the email body.
  4. Stop immediately after the last sentence.
`

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generates length-guidance text used by the model.
 */
function getLengthInstructions(level: 'concise' | 'detailed'): string {
  return level === 'concise'
    ? 'Keep the entire email very brief. Focus only on essential information and keep the email short.'
    : 'Provide a comprehensive email with elaboration, context, and helpful detail.'
}

/**
 * Converts sender details into a readable fragment for AI conditioning.
 */
function formatSenderInfo(info: UserInfo): string {
  const parts = []
  if (info.name) parts.push(`Name: ${info.name}`)
  if (info.company) parts.push(`Company: ${info.company}`)
  if (info.position) parts.push(`Position: ${info.position}`)
  if (info.phone) parts.push(`Phone: ${info.phone}`)
  if (info.email) parts.push(`Email: ${info.email}`)

  if (!parts.length) return ''

  let result = `Here is my (the sales rep) contact information: ${parts.join(', ')}. `

  result += `INTRODUCTION RULE: Introduce yourself in the FIRST SENTENCE ONLY (e.g., "Hi [Name], this is Dema with Granite Depot..."). `
  result += `NEVER mention my name or company at the end of the email. `
  // ----------------------------

  result += `PHONE/EMAIL RULES: For FIRST-CONTACT emails - NEVER write phone or email in the body. `
  result += `Always end FIRST-CONTACT emails with a direct question. `
  result += `For REPLY emails - include phone ONLY if customer asks. `
  return result
}

/**
 * Retrieves lead fields needed for content generation.
 */
async function getLeadInfoByDeal(dealId?: number): Promise<LeadInfo> {
  if (!dealId) return {}
  const [rows] = await db.execute<RowDataPacket[]>(
    `
       SELECT
         c.name AS customerName,
         c.company_name AS customerCompany,   -- <-- NEW
         c.details,
         c.your_message,
         c.referral_source,
         c.remodal_type
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       WHERE d.id = ? AND d.deleted_at IS NULL
     `,
    [dealId],
  )

  if (!rows?.length) return {}

  const row = rows[0]
  return {
    customerName: row.customerName || undefined,
    customerCompany: row.customerCompany || undefined, // <-- NEW
    leadMessage: row.details || row.your_message || undefined,
    remodelType: row.remodal_type || undefined,
    referralSource: row.referral_source || undefined,
  }
}

async function getEmailHistoryByDeal(
  dealId: number,
  subject?: string,
): Promise<EmailHistoryItem[]> {
  let query = `
       SELECT
         e.body,
         e.sent_at,
         e.sender_user_id
       FROM emails e
       WHERE e.deal_id = ? AND e.deleted_at IS NULL`
  const params: (number | string)[] = [dealId]

  if (subject) {
    query += ' AND e.subject = ?'
    params.push(subject)
  }

  query += ' ORDER BY e.sent_at ASC'

  const [rows] = await db.execute<RowDataPacket[]>(query, params)

  if (!rows?.length) return []

  return rows.map(row => ({
    body: row.body,
    sentAt: row.sent_at,
    isFromCustomer: row.sender_user_id === null,
  }))
}

async function getEmailHistoryByThread(
  dealId: number,
  threadId: string,
): Promise<EmailHistoryItem[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
      SELECT
        e.body,
        e.sent_at,
        e.sender_user_id
      FROM emails e
      WHERE e.deleted_at IS NULL AND e.thread_id = ? AND (e.deal_id = ? OR e.deal_id IS NULL)
      ORDER BY e.sent_at ASC
    `,
    [threadId, dealId],
  )

  if (!rows?.length) return []

  return rows.map(row => ({
    body: row.body,
    sentAt: row.sent_at,
    isFromCustomer: row.sender_user_id === null,
  }))
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

/**
 * Builds the final text message sent to the model.
 */
function buildUserPrompt(
  params: EmailGenerationParams,
  lead: LeadInfo,
  userInfo: UserInfo,
  emailHistory?: EmailHistoryItem[],
): string {
  const {
    emailCategory,
    formality = 'neutral',
    tone = 'friendly',
    verboseness = 'concise',
    urgencyLevel = 'medium',
    desiredContent,
  } = params

  const { customerName, leadMessage, remodelType, referralSource, customerCompany } =
    lead
  const { variationToken } = params

  let prompt = `Write a ${formality}, ${tone} sales email. `
  prompt += `Email type: ${emailCategory}. `
  prompt += `Verboseness: ${verboseness}. ${getLengthInstructions(verboseness)} `
  prompt += `Urgency level: ${urgencyLevel}. `

  // --- CHANGED SECTION START ---
  // Context block
  prompt += `\nCONTEXT DETAILS:`
  if (customerName) prompt += `\n- Recipient Name: ${customerName}`
  if (customerCompany) prompt += `\n- Recipient Company: ${customerCompany}`

  // Lead Message Logic
  if (leadMessage) {
    prompt += `\n- Customer's Original Request: "${leadMessage}"`
    prompt += `\n INSTRUCTION: Analyze the customer's request above. If they asked for a specific action (like a visit, a call, or a quote), respond to that specifically. Do not just say "tell me more" if they already asked you to come over.`
  }

  if (referralSource) prompt += `\n- Source: ${referralSource}`
  if (remodelType) prompt += `\n- Project Type: ${remodelType}`

  if (desiredContent) {
    prompt += `\n- Additional specific content to include: ${desiredContent}`
  }
  // --- CHANGED SECTION END ---

  if (emailHistory?.length) {
    const historyText = emailHistory
      .map((item, index) => {
        const sender = item.isFromCustomer ? 'Customer' : 'You (sales rep)'
        return `Message ${index + 1} from ${sender} on ${item.sentAt}:\n${item.body}`
      })
      .join('\n\n')
    prompt += `\n\nPREVIOUS CONVERSATION HISTORY:\n${historyText}\n`
    prompt += `Instruction: Write a natural next step in this thread.`
  }

  if (variationToken) {
    prompt += `\nVariation hint: ${variationToken}. `
  }

  prompt += `\n\n${formatSenderInfo(userInfo)}`

  // ... (оставьте часть про Subject Line без изменений)
  prompt += `
  STRICT INSTRUCTION FOR SUBJECT LINE:
  1. FORMAT: Sentence case. First letter capitalized.
  2. STYLE: Casual, short (2-5 words).
  3. CONTENT: Relevant to the project.
`

  return prompt
}

// ============================================================================
// STREAMING
// ============================================================================

async function createStreamingResponse(
  params: EmailGenerationParams,
  userInfo: UserInfo,
): Promise<ReadableStream> {
  const lead = await getLeadInfoByDeal(params.dealId)
  let emailHistory: EmailHistoryItem[] = []

  if (!params.skipHistory && params.dealId) {
    emailHistory = params.threadId
      ? await getEmailHistoryByThread(params.dealId, params.threadId)
      : await getEmailHistoryByDeal(params.dealId, params.subject)
  }

  const userPrompt = buildUserPrompt(params, lead, userInfo, emailHistory)

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
        })

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
            )
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
        )
        controller.close()
      } catch (err) {
        posthogClient.captureException(err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`),
        )
        controller.close()
      }
    },
  })
}

// ============================================================================
// ERRORS
// ============================================================================

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function action({ request }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to authorize', 401)
  }

  let params: EmailGenerationParams
  try {
    params = generateSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Invalid request data', 400)
  }

  try {
    const userInfo = await getUserInfo(user)
    const stream = await createStreamingResponse(params, userInfo)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to generate response', 500)
  }
}
