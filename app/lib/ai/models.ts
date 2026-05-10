export const MODELS = {
  default: 'gpt-5.4-mini-2026-03-17',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]
