import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
  maxRetries: 3,
  timeout: 30_000,
})
