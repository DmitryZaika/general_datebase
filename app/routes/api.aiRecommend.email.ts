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
  recipientCompany: z.string().optional(),
  recipientRole: z.string().optional(),
  relationshipStage: z
    .enum(['lead', 'customer', 'past-customer', 'prospect'])
    .optional(),
  formality: z.enum(['formal', 'neutral', 'casual']).optional(),
  tone: z.enum(['friendly', 'persuasive', 'empathetic', 'urgent']).optional(),
  verboseness: z.enum(['concise', 'detailed']).optional(),
  language: z.string().optional(),
  desiredContent: z.string().optional(),
  previousMessages: z.array(z.string()).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  // --- sender fields ---
  senderName: z.string().optional(),
  senderCompany: z.string().optional(),
  senderPosition: z.string().optional(),
  senderPhoneNumber: z.string().optional(),
  senderEmail: z.string().email().optional(),
})

function generate_user_message(cleanData: z.infer<typeof generateSchema>) {
  const {
    emailCategory = 'first-contact',
    recipientName = 'the recipient',
    recipientCompany,
    recipientRole,
    relationshipStage,
    formality = 'neutral',
    tone = 'friendly',
    verboseness = 'concise',
    language = 'English',
    desiredContent,
    previousMessages,
    urgencyLevel = 'medium',
    senderName,
    senderCompany,
    senderPosition,
    senderPhoneNumber,
    senderEmail,
  } = cleanData

  let message = `Write a ${verboseness}, ${formality}, ${tone} sales email in ${language}. `
  message += `Email type: ${emailCategory}. `
  message += `Recipient: ${recipientName}`
  if (recipientCompany) message += ` from ${recipientCompany}`
  if (recipientRole) message += ` (${recipientRole})`
  message += '. '
  if (relationshipStage) message += `Relationship stage: ${relationshipStage}. `
  if (desiredContent) message += `Include this content: ${desiredContent}. `
  if (previousMessages && previousMessages.length > 0) {
    message += `Previous messages: ${previousMessages.join(' | ')}. `
  }
  message += `Urgency level: ${urgencyLevel}. `

  // Include sender info, but only if provided
  const senderParts: string[] = []
  if (senderName) senderParts.push(senderName)
  if (senderPosition) senderParts.push(senderPosition)
  if (senderCompany) senderParts.push(senderCompany)
  if (senderPhoneNumber) senderParts.push(`Phone: ${senderPhoneNumber}`)
  if (senderEmail) senderParts.push(`Email: ${senderEmail}`)

  if (senderParts.length > 0) {
    message += `The email should be sent from: ${senderParts.join(' • ')}. `
  }

  // Modified prompt for streaming
  message += `First provide ONLY the subject line (no label, just the subject text). Then on a new line write "---BODY---". Then provide the email body with professional signature.`

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
  You are an expert sales email assistant.
  Your goal is to generate professional, persuasive, and realistic sales emails that could be sent immediately.
  Use all provided recipient and sender information.
  If any sender information is missing, simply omit it from the email and signature. Do not make up values.
  Follow the user's formatting instructions exactly.
  Do not include placeholders, brackets, or any extra commentary.
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
            model: 'gpt-4o',
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
