import { MODELS } from '../models'
import { CHAT_SYSTEM_PREAMBLE } from '../prompts/chatSystem'
import type { AITask, ChatMessage } from '../types'

export interface InstructionItem {
  id: number
  title: string
  rich_text: string
}

export type ChatInput =
  | {
      mode: 'new'
      query: string
      instructions: InstructionItem[]
    }
  | {
      mode: 'continue'
      query: string
      history: ChatMessage[]
    }

function formatInstructions(items: InstructionItem[]): string {
  if (items.length === 0) return '(no instructions configured for this company)'
  return items.map(i => `## ${i.title}\n${i.rich_text}`).join('\n\n')
}

export const chatTask: AITask<ChatInput, string> = {
  name: 'chat',
  model: MODELS.default,
  temperature: 0,
  maxTokens: 1024,
  buildMessages: (input): ChatMessage[] => {
    if (input.mode === 'new') {
      const systemContent =
        CHAT_SYSTEM_PREAMBLE + formatInstructions(input.instructions)
      return [
        { role: 'system', content: systemContent },
        { role: 'user', content: input.query },
      ]
    }
    return [...input.history, { role: 'user', content: input.query }]
  },
}
