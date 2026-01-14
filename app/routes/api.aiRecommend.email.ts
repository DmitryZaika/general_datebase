// Refactored, modular, and well‑commented implementation

import type { RowDataPacket } from 'mysql2'
import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

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

  if (user.company_id) {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT name FROM company WHERE id = ? LIMIT 1`,
        [user.company_id],
      )
      if (rows?.length) {
        companyName = rows[0].name
      }
    } catch (err) {
      console.error('Failed to load company info:', err)
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
      console.error('Failed to load position info:', err)
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
  dealId: z.number(),
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
  You are an expert sales email assistant. Your purpose is to generate professional, persuasive, and realistically usable emails. Always follow the user’s formatting instructions exactly. Do not add commentary, labels, placeholders, or a signature. The application will insert the signature separately.

  Use all provided sender and recipient information. If any sender details are missing, simply omit them. Never invent names, companies, phone numbers, or facts.

  Use the proper spacing and formatting for the text.

  SUBJECT LINE RULES (CRITICAL):
  • Style: Casual, short, and "boring". Like a quick email from a colleague or friend.
  • Length: Maximum 2-5 words.
  • Capitalization: Use sentence case (Only the first letter capitalized). NEVER use Title Case.
  • Punctuation: No exclamation marks (!). No questions marks (?) unless absolutely necessary.
  • Content: Avoid "salesy" words like "Special", "Offer", "Unlock", "Dream".

  EMAIL CATEGORY DEFINITIONS

  FIRST-CONTACT
  Used when the recipient already reached out through another channel. Tone: warm and helpful. Purpose: acknowledge their request, introduce yourself, and ALWAYS end with a specific question to encourage a reply (e.g., about their project details or availability). This is crucial for email deliverability.
  Examples:
 • “Good morning, [Name]! This is [Sender] from [Company]. Thanks for reaching out about new countertops. Could you tell me a bit more about your project?”

• "Hey [Name], this is [Sender], with [Company]. You asked us to call you back. Looks like you responded to our ad on [Social Media] about updating your kitchen. Are you currently available to provide me with more information about your project?"

• "Hi [Name], this is [Sender]. Thank you for your request to [Company]! I see you’re looking into new countertops. I have a few quick questions to give you an accurate quote. When would be a good time to discuss your project?"

• "Hey [Name], this is [Sender] with [Company]. I just reviewed your request and I have a few questions about your project. When would be a good time to give you a call?"



  FOLLOW-UP
  Used when someone has shown interest or received a quote but hasn’t responded. Tone: polite and low-pressure. Purpose: check in, re-open conversation, and offer support.
  Examples:
  • “Hi [Name], just checking in to see if you're still considering new countertops…”
  • “Hi [Name], I wanted to follow up on your quote and see if you had any questions…”

  REPLY
  Used to respond directly to the recipient’s message. Tone: responsive and clear.
  Examples:
  • “Thanks for your question about quartz colors…”
  • “I appreciate your message. Yes, we can schedule the measurement this week…”

  PROMOTIONAL
  Used for offers or specials. Tone: upbeat and value-focused.
  Examples:
  • “We’re offering a limited-time discount on quartz countertops…”
  • “We just launched new materials that might be perfect for your project…”

  THANK-YOU
  Used to express appreciation for a visit, call, inquiry, or purchase. Tone: warm and courteous.
  Examples:
  • “Thank you for stopping by our showroom today…”
  • “Thanks for taking the time to speak with me earlier…”

  FEEDBACK-REQUEST
  The countertops are ALREADY INSTALLED. Ask for feedback about the installation - how did it go? Are they happy with the result? DO NOT mention quotes, colors, or materials. Focus only on asking about the installation experience. Tone: appreciative and concise.

  REFERRAL
  Used AFTER the installation is complete. Ask if they know anyone who might also be interested in buying countertops. Tone: friendly and non-pushy. Be creative and natural. DO NOT mention specific colors, materials, or details about what the customer purchased. Keep it general.

  GENERAL RULES
  • Match the requested tone, formality, and verboseness.
  • Never include a signature or contact block.
  • PHONE/EMAIL RULES:
    - FIRST-CONTACT emails: NEVER include phone number or email address. No exceptions.
    - REPLY emails: Include phone number ONLY if customer explicitly asks (e.g., "can you call?", "give me your number").
  • Do not invent details.
  • If the referral source is mentioned as "wordPress", always refer to it as "web-site" in the email text.
  • Avoid placeholders or brackets in your output. Write full, natural sentences.
  • Follow the output structure exactly:
    1. Provide ONLY the subject line (no "Subject:" prefix).
    2. Next line: ---BODY---
    3. Then the email body (no signature).

  You generate emails that are clean, professional, and ready to use immediately.
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
  result += `PHONE/EMAIL RULES: For FIRST-CONTACT emails - NEVER write phone or email in the body. `
  result += `Always end FIRST-CONTACT emails with a direct question (e.g., "Could you tell me more about the project?" or "When is a good time for a call?"). `
  result += `For REPLY emails - include phone ONLY if customer asks ("can you call?", "give me your number"). `
  result += `Introduce myself using only my first name and company. Use only the first name of the customer. Don't use signature.`
  return result
}

/**
 * Retrieves lead fields needed for content generation.
 */
async function getLeadInfoByDeal(dealId: number): Promise<LeadInfo> {
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

  // Incorporate lead details into the instruction
  if (customerName) {
    prompt += `Address the recipient by their name: ${customerName}. `
  }
  if (customerCompany) {
    prompt += `Mention the customer's company: ${customerCompany}. `
  }
  if (leadMessage) {
    prompt += `Acknowledge how the lead originally came in: ${leadMessage}. `
  }
  if (referralSource) {
    prompt += `Mention the referral source (e.g., Facebook, phone, etc): ${referralSource}. `
  }
  if (remodelType) {
    prompt += `Reference the project type they are interested in: ${remodelType}. `
  }

  if (desiredContent) {
    prompt += `Include this content: ${desiredContent}. `
  }

  if (emailHistory && emailHistory.length) {
    const historyText = emailHistory
      .map((item, index) => {
        const sender = item.isFromCustomer ? 'Customer' : 'You (sales rep)'
        return `Message ${index + 1} from ${sender} on ${item.sentAt}:\n${item.body}`
      })
      .join('\n\n')
    prompt += `Here is the previous email conversation with this customer. Use it as context and write a natural next email in the same thread without repeating their exact wording:\n${historyText}\n`
  }

  if (variationToken) {
    prompt += `Use a slightly different style than any previous email by following this variation hint: ${variationToken}. `
  }

  prompt += formatSenderInfo(userInfo)

  prompt += `
  STRICT INSTRUCTION FOR SUBJECT LINE:
  1. FORMAT: Use standard Sentence case. **The first letter MUST be capitalized.** (e.g., "Your kitchen", NOT "your kitchen").
  2. STYLE: Casual and short (2-5 words). No "salesy" adjectives.
  3. CONTENT: specific to the project.
  
  Examples of CORRECT subjects:
  - "Your quartzite quote"
  - "Your countertop quote"
  - "Your kitchen quote"
  - "Countertop quote request"
  - "In-home estimate request"
  - "Countertop inquiry"
  - "Thank you for your inquiry!"
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
  const emailHistory = params.skipHistory
    ? []
    : params.threadId
      ? await getEmailHistoryByThread(params.dealId, params.threadId)
      : await getEmailHistoryByDeal(params.dealId, params.subject)
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
  let user
  try {
    user = await getEmployeeUser(request)
  } catch {
    return createErrorResponse('Failed to authorize', 401)
  }

  let params: EmailGenerationParams
  try {
    params = generateSchema.parse(await request.json())
  } catch {
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
  } catch {
    return createErrorResponse('Failed to generate response', 500)
  }
}
