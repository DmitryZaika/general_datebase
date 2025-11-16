import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

// --- Zod schema ---
export const generateSchema = z.object({
  emailCategory: z.enum([
    'first-contact',
    'follow-up',
    'reply',
    'promotional',
    'thank-you',
    'feedback-request',
    'referral',
  ]),
  recipientName: z.string().min(1, 'Recipient name is required'),
  formality: z.enum(['formal', 'neutral', 'casual']).optional(),
  tone: z.enum(['friendly', 'persuasive', 'empathetic', 'urgent']).optional(),
  verboseness: z.enum(['concise', 'detailed']).optional(),
  desiredContent: z.string().optional(),
  previousMessages: z.array(z.string()).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  // --- sender fields ---
  senderName: z.string().optional(),
  senderCompany: z.string().optional(),
})

function generate_user_message(cleanData: z.infer<typeof generateSchema>) {
  const {
    emailCategory = 'first-contact',
    recipientName = 'the recipient',
    formality = 'neutral',
    tone = 'friendly',
    verboseness = 'concise',
    desiredContent,
    previousMessages,
    urgencyLevel = 'medium',
    senderName,
    senderCompany,
    senderPosition,
    senderPhoneNumber,
    senderEmail,
  } = cleanData

  // Explicit length/structure enforcement
  let lengthInstructions = ''
  switch (verboseness) {
    case 'concise':
      lengthInstructions =
        'Keep the entire email very brief. Focus only on essential information and keep the email short.'
      break
    case 'detailed':
      lengthInstructions =
        'Provide a comprehensive email with helpful context, elaboration, and clear next steps. Include descriptive detail and compelling explanations.'
      break
  }

  let message = `Write a ${formality}, ${tone} sales email. `
  message += `Email type: ${emailCategory}. `
  message += `Verboseness: ${verboseness}. ${lengthInstructions} `
  message += `Recipient: ${recipientName}. `
  if (desiredContent) message += `Include this content: ${desiredContent}. `
  if (previousMessages && previousMessages.length > 0) {
    message += `Previous messages: ${previousMessages.join(' | ')}. `
  }
  message += `Urgency level: ${urgencyLevel}. `

  // Include sender info only if provided
  const senderParts: string[] = []
  if (senderName) senderParts.push(senderName)
  if (senderPosition) senderParts.push(senderPosition)
  if (senderCompany) senderParts.push(senderCompany)
  if (senderPhoneNumber) senderParts.push(`Phone: ${senderPhoneNumber}`)
  if (senderEmail) senderParts.push(`Email: ${senderEmail}`)

  if (senderParts.length > 0) {
    message += `The email should be written as coming from: ${senderParts.join(' • ')}. `
  }

  // Output structure instructions (NO signature)
  message +=
    `First provide ONLY the subject line (no label, just the subject text). ` +
    `Then on a new line write "---BODY---". ` +
    `Then provide the email body. Do not include any signature, sign-off, or sender information at the end; I will add the signature manually.`

  return message
}

// --- API action with streaming support ---
export async function action({ request }: ActionFunctionArgs) {
  // Authorize user
  try {
    await getEmployeeUser(request)
  } catch (error) {
    console.error('Auth error:', error)
    return new Response(JSON.stringify({ error: 'Failed to authorize' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request data
  let cleanData
  try {
    const requestData = await request.json()
    cleanData = generateSchema.parse(requestData)
  } catch (error) {
    console.error('Parse error:', error)
    return new Response(JSON.stringify({ error: 'Invalid request data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // OpenAI request with streaming
  const systemPrompt = `
  You are an expert sales email assistant. Your purpose is to generate professional, persuasive, and realistically usable emails. Always follow the user’s formatting instructions exactly. Do not add commentary, labels, placeholders, or a signature. The application will insert the signature separately.

  Use all provided sender and recipient information. If any sender details are missing, simply omit them. Never invent names, companies, phone numbers, or facts.

  EMAIL CATEGORY DEFINITIONS

  FIRST-CONTACT
  Used when the recipient already reached out through another channel. Tone: warm and helpful. Purpose: acknowledge their request, introduce yourself, and ask for a convenient time to talk.
  Examples:
  • “Good morning, [Name]! This is [Sender] from [Company]. Thanks for reaching out about new countertops…”
  • “Hi [Name], I saw your request come in and wanted to introduce myself…”

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
  Used to request a review or general feedback. Tone: appreciative and concise.
  Examples:
  • “When you have a moment, could you share feedback about your project experience?”
  • “Your input means a lot to us…”

  REFERRAL
  Used to request or acknowledge referrals. Tone: friendly and non-pushy.
  Examples:
  • “If you know anyone planning countertop work, I’d be grateful if you passed along my info.”
  • “Happy to help anyone you think could benefit from our services.”

  GENERAL RULES
  • Match the requested tone, formality, and verboseness.
  • Never include a signature or contact block.
  • Do not invent details.
  • Avoid placeholders or brackets in your output. Write full, natural sentences.
  • Follow the output structure exactly:
    1. Provide ONLY the subject line (no “Subject:” prefix).
    2. Next line: ---BODY---
    3. Then the email body (no signature).

  You generate emails that are clean, professional, and ready to use immediately.
  `

  try {
    const userMessage = generate_user_message(cleanData)

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          // Use OpenAI streaming API
          const completion = await client.chat.completions.create({
            model: 'gpt-4.1-mini-2025-04-14',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            stream: true,
          })

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              // Send each chunk as SSE
              const data = JSON.stringify({ content })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Send completion signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
          )
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = JSON.stringify({ error: 'Streaming failed' })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('OpenAI error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
