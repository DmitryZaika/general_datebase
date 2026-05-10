import { posthogClient } from '~/utils/posthog.server'
import { MODELS } from './models'
import type { Usage } from './types'

export function trackUsage(
  taskName: string,
  usage: Usage | undefined,
  userId?: number,
) {
  if (!usage) return
  posthogClient.capture({
    distinctId: userId?.toString() ?? 'system',
    event: 'ai_call',
    properties: {
      task: taskName,
      model: MODELS.default,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
      total_tokens: usage.total_tokens,
    },
  })
}
