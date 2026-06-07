import { describe, expect, it } from 'vitest'
import { buildSmsReactionMessage } from './smsReactionText'

describe('buildSmsReactionMessage', () => {
  it('links emoji to quoted message text', () => {
    expect(buildSmsReactionMessage('👍', '😚 🤥')).toBe('👍 to "😚 🤥"')
  })

  it('truncates long quoted text', () => {
    const long = 'a'.repeat(200)
    const result = buildSmsReactionMessage('❤️', long)
    expect(result.startsWith('❤️ to "')).toBe(true)
    expect(result.endsWith('…"')).toBe(true)
    expect(result.length).toBeLessThan(140)
  })

  it('returns emoji only when reacted text is empty', () => {
    expect(buildSmsReactionMessage('👍', '   ')).toBe('👍')
  })
})
