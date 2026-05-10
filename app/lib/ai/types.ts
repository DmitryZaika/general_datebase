import type OpenAI from 'openai'
import type { z } from 'zod'

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam

export interface AITask<Input, Output> {
  name: string
  model: string
  buildMessages: (input: Input) => ChatMessage[]
  outputSchema?: z.ZodType<Output>
  temperature?: number
  maxTokens?: number
}

export type SSEEvent =
  | { type: 'delta'; content: string }
  | { type: 'final'; data: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string }

export type Usage = OpenAI.Completions.CompletionUsage
