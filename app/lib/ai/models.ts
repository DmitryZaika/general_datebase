export const MODELS = {
  default: 'gpt-4.1-mini-2025-04-14',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]
