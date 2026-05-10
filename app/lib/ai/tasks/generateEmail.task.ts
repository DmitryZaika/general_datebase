import { z } from 'zod'
import { MODELS } from '../models'
import { GENERATE_EMAIL_SYSTEM } from '../prompts/generateEmailSystem'
import type { AITask, ChatMessage } from '../types'

export const EmailCategoryEnum = z.enum([
  'first-contact',
  'follow-up',
  'reply',
  'promotional',
  'thank-you',
  'feedback-request',
  'referral',
])

export const GenerateEmailParams = z.object({
  emailCategory: EmailCategoryEnum,
  formality: z.enum(['formal', 'neutral', 'casual']).optional(),
  tone: z.enum(['friendly', 'persuasive', 'empathetic', 'urgent']).optional(),
  verboseness: z.enum(['concise', 'detailed']).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  desiredContent: z.string().optional(),
  subject: z.string().optional(),
})
export type GenerateEmailParamsT = z.infer<typeof GenerateEmailParams>

export interface LeadInfo {
  customerName?: string
  customerCompany?: string
  leadMessage?: string
  remodelType?: string
  referralSource?: string
}

export interface SenderInfo {
  name: string
  company?: string
  phone?: string
  email?: string
  position?: string
}

export interface EmailHistoryItem {
  body: string
  sentAt: string
  isFromCustomer: boolean
}

export interface GenerateEmailInput {
  params: GenerateEmailParamsT
  lead: LeadInfo
  sender: SenderInfo
  history: EmailHistoryItem[]
}

export const GenerateEmailOutput = z.object({
  subject: z.string(),
  body: z.string(),
})
export type GenerateEmailOutputT = z.infer<typeof GenerateEmailOutput>

function buildSenderBlock(sender: SenderInfo): string {
  const parts: string[] = [`Name: ${sender.name}`]
  if (sender.company) parts.push(`Company: ${sender.company}`)
  if (sender.position) parts.push(`Position: ${sender.position}`)
  if (sender.phone) parts.push(`Phone: ${sender.phone}`)
  if (sender.email) parts.push(`Email: ${sender.email}`)
  return parts.join(', ')
}

function buildUserPrompt(input: GenerateEmailInput): string {
  const { params, lead, sender, history } = input
  const formality = params.formality ?? 'neutral'
  const tone = params.tone ?? 'friendly'
  const verboseness = params.verboseness ?? 'concise'
  const urgencyLevel = params.urgencyLevel ?? 'medium'

  let prompt = `Write a ${formality}, ${tone} sales email.\n`
  prompt += `Email type: ${params.emailCategory}\n`
  prompt += `Verboseness: ${verboseness}\n`
  prompt += `Urgency level: ${urgencyLevel}\n`

  prompt += '\nCONTEXT:\n'
  if (lead.customerName) prompt += `- Recipient name: ${lead.customerName}\n`
  if (lead.customerCompany) prompt += `- Recipient company: ${lead.customerCompany}\n`
  if (lead.leadMessage) {
    prompt += `- Customer's original request: "${lead.leadMessage}"\n`
    prompt += `  Instruction: if they asked for a specific action, address it directly.\n`
  }
  if (lead.referralSource) prompt += `- Source: ${lead.referralSource}\n`
  if (lead.remodelType) prompt += `- Project type: ${lead.remodelType}\n`
  if (params.desiredContent) {
    prompt += `- Specific content to include: ${params.desiredContent}\n`
  }

  if (history.length > 0) {
    prompt += '\nPREVIOUS CONVERSATION:\n'
    for (const [i, item] of history.entries()) {
      const who = item.isFromCustomer ? 'Customer' : 'You (sales rep)'
      prompt += `Message ${i + 1} from ${who} on ${item.sentAt}:\n${item.body}\n\n`
    }
    prompt += 'Instruction: write the natural next message in this thread.\n'
  }

  prompt += `\nSENDER (you): ${buildSenderBlock(sender)}\n`

  return prompt
}

export const generateEmailTask: AITask<GenerateEmailInput, GenerateEmailOutputT> = {
  name: 'generate_email',
  model: MODELS.default,
  temperature: 0.7,
  maxTokens: 800,
  outputSchema: GenerateEmailOutput,
  buildMessages: (input): ChatMessage[] => [
    { role: 'system', content: GENERATE_EMAIL_SYSTEM },
    { role: 'user', content: buildUserPrompt(input) },
  ],
}
