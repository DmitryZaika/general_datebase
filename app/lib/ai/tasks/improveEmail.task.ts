import { z } from 'zod'
import { MODELS } from '../models'
import { IMPROVE_EMAIL_SYSTEM } from '../prompts/improveEmailSystem'
import type { AITask } from '../types'

export interface ImproveEmailInput {
  body: string
}

export const ImproveEmailOutput = z.object({
  body: z.string(),
})
export type ImproveEmailOutputT = z.infer<typeof ImproveEmailOutput>

export const improveEmailTask: AITask<ImproveEmailInput, ImproveEmailOutputT> = {
  name: 'improve_email',
  model: MODELS.default,
  temperature: 0.2,
  maxTokens: 1500,
  outputSchema: ImproveEmailOutput,
  buildMessages: ({ body }) => [
    { role: 'system', content: IMPROVE_EMAIL_SYSTEM },
    { role: 'user', content: body },
  ],
}
