import { describe, expect, it } from 'vitest'
import {
  buildSmsReactionMessage,
  collectReactionsByMessageId,
  filterVisibleSmsMessages,
  isSmsReactionMessage,
  parseSmsReactionMessage,
} from './smsReactionText'
import type { SmsMessage } from './types'

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

describe('parseSmsReactionMessage', () => {
  it('parses tapback-style reaction sms', () => {
    expect(parseSmsReactionMessage('👍 to "Thanks!"')).toEqual({
      emoji: '👍',
      quotedText: 'Thanks!',
    })
  })

  it('returns null for normal messages', () => {
    expect(parseSmsReactionMessage('Hello there')).toBeNull()
  })
})

describe('collectReactionsByMessageId', () => {
  it('maps outbound reaction sms to inbound message ids', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'inbound',
        text: 'Can you call me?',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'outbound',
        text: '👍 to "Can you call me?"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
    ]

    expect(collectReactionsByMessageId(messages)).toEqual({ '1': ['👍'] })
  })

  it('hides reaction sms from visible conversation messages', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'inbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'outbound',
        text: '❤️ to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
    ]

    expect(isSmsReactionMessage(messages[1].text)).toBe(true)
    expect(filterVisibleSmsMessages(messages).map(message => message.id)).toEqual(['1'])
  })
})
