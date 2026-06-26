import { describe, expect, it } from 'vitest'
import {
  addReactionToMap,
  buildSmsReactionMessage,
  buildSmsReactionRemovalMessage,
  collectReactionsByMessageId,
  filterVisibleSmsMessages,
  getReactionsForMessage,
  isSmsReactionMessage,
  mergeMessageReactions,
  normalizeReactionDisplay,
  parseSmsReactionMessage,
  parseSmsReactionRemovalMessage,
  unwrapReactionQuotedText,
} from './smsReactionText'
import type { SmsMessage } from './types'

describe('buildSmsReactionRemovalMessage', () => {
  it('builds removal sms text', () => {
    expect(buildSmsReactionRemovalMessage('👍', 'Hi')).toBe('Removed 👍 from "Hi"')
  })
})

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
    expect(parseSmsReactionMessage("👍 to 'Hi'")).toEqual({
      emoji: '👍',
      quotedText: 'Hi',
    })
    expect(parseSmsReactionMessage('cool to "Hi"')).toEqual({
      emoji: 'cool',
      quotedText: 'Hi',
    })
    expect(parseSmsReactionMessage('cool\' to "Hi"')).toEqual({
      emoji: "cool'",
      quotedText: 'Hi',
    })
    expect(parseSmsReactionMessage('cool to Hi')).toEqual({
      emoji: 'cool',
      quotedText: 'Hi',
    })
    expect(parseSmsReactionMessage('Liked "Hi"')).toEqual({
      emoji: 'Liked',
      quotedText: 'Hi',
    })
  })

  it('maps word tapback labels to emoji for display', () => {
    expect(normalizeReactionDisplay('cool')).toBe('😎')
    expect(normalizeReactionDisplay("cool'")).toBe('😎')
    expect(normalizeReactionDisplay('Liked')).toBe('👍')
  })

  it('returns null for normal messages', () => {
    expect(parseSmsReactionMessage('Hello there')).toBeNull()
  })

  it('detects nested reaction sms for hiding', () => {
    expect(isSmsReactionMessage('👍 to " 👍 to " 😚 🤨 " "')).toBe(true)
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

    expect(collectReactionsByMessageId(messages)).toEqual({
      '1': ['👍'],
      'text:can you call me?': ['👍'],
    })
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

  it('maps inbound webhook echo reactions onto outbound messages', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'inbound',
        text: "👍 to 'Hi'",
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
    ]

    expect(collectReactionsByMessageId(messages)).toEqual({
      '1': ['👍'],
      'text:hi': ['👍'],
    })
    expect(filterVisibleSmsMessages(messages).map(message => message.id)).toEqual(['1'])
  })

  it('unwraps nested reaction quotes when matching targets', () => {
    expect(unwrapReactionQuotedText('👍 to "Hi"')).toBe('Hi')
  })

  it('removes reactions when removal sms is received', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'outbound',
        text: '👍 to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
      {
        id: '3',
        direction: 'inbound',
        text: "Removed 👍 from 'Hi'",
        agent: null,
        createdAt: '2026-01-01T10:02:00.000Z',
        status: 'sent',
      },
    ]

    expect(parseSmsReactionRemovalMessage("Removed 👍 from 'Hi'")).toEqual({
      emoji: '👍',
      quotedText: 'Hi',
    })
    expect(isSmsReactionMessage("Removed 👍 from 'Hi'")).toBe(true)
    expect(collectReactionsByMessageId(messages)).toEqual({})
    expect(filterVisibleSmsMessages(messages).map(message => message.id)).toEqual(['1'])
  })

  it('removes reactions from every message that shares quoted text', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'outbound',
        text: '👍 to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
      {
        id: '3',
        direction: 'inbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:02:00.000Z',
        status: 'sent',
      },
      {
        id: '4',
        direction: 'outbound',
        text: '👍 to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:03:00.000Z',
        status: 'sent',
      },
      {
        id: '5',
        direction: 'inbound',
        text: "Removed 👍 from 'Hi'",
        agent: null,
        createdAt: '2026-01-01T10:04:00.000Z',
        status: 'sent',
      },
    ]

    const reactions = collectReactionsByMessageId(messages)
    expect(reactions).toEqual({})
    expect(getReactionsForMessage(messages[0], reactions)).toEqual([])
    expect(getReactionsForMessage(messages[2], reactions)).toEqual([])
  })

  it('shows customer cool reaction on outbound Hi', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'inbound',
        text: 'cool to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
    ]

    const reactions = collectReactionsByMessageId(messages)
    expect(getReactionsForMessage(messages[0], reactions)).toEqual(['😎'])
    expect(filterVisibleSmsMessages(messages).map(message => message.id)).toEqual(['1'])
  })

  it('maps customer inbound reactions onto outbound messages', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'How can I help?',
        agent: 'Agent',
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'inbound',
        text: 'How can I help?',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
      {
        id: '3',
        direction: 'inbound',
        text: "👍 to 'How can I help?'",
        agent: null,
        createdAt: '2026-01-01T10:02:00.000Z',
        status: 'sent',
      },
    ]

    const reactions = collectReactionsByMessageId(messages)
    expect(getReactionsForMessage(messages[0], reactions)).toEqual(['👍'])
    expect(reactions['1']).toEqual(['👍'])
  })

  it('shows customer reactions after a prior removal', () => {
    const messages: SmsMessage[] = [
      {
        id: '1',
        direction: 'outbound',
        text: 'Hi',
        agent: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'sent',
      },
      {
        id: '2',
        direction: 'outbound',
        text: '👍 to "Hi"',
        agent: null,
        createdAt: '2026-01-01T10:01:00.000Z',
        status: 'sent',
      },
      {
        id: '3',
        direction: 'inbound',
        text: "Removed 👍 from 'Hi'",
        agent: null,
        createdAt: '2026-01-01T10:02:00.000Z',
        status: 'sent',
      },
      {
        id: '4',
        direction: 'inbound',
        text: "👍 to 'Hi'",
        agent: null,
        createdAt: '2026-01-01T10:03:00.000Z',
        status: 'sent',
      },
    ]

    const reactions = collectReactionsByMessageId(messages)
    expect(getReactionsForMessage(messages[0], reactions)).toEqual(['👍'])
  })

  it('resolves reactions by message text when ids differ', () => {
    const message: SmsMessage = {
      id: '99',
      direction: 'outbound',
      text: 'Hi',
      agent: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'sent',
    }
    const map = addReactionToMap({}, '1', 'Hi', '👍')
    expect(getReactionsForMessage(message, map)).toEqual(['👍'])
  })

  it('prefers message id reactions over shared text key', () => {
    const message: SmsMessage = {
      id: '2',
      direction: 'inbound',
      text: 'Hi',
      agent: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'sent',
    }
    const map = {
      '2': [],
      'text:hi': ['👍'],
    }
    expect(getReactionsForMessage(message, map)).toEqual([])
  })
})

describe('mergeMessageReactions', () => {
  it('does not hide new customer reactions behind stale local clears', () => {
    const server = {
      '1': ['👍'],
      'text:hi': ['👍'],
    }
    const local = {
      '1': [],
    }
    expect(mergeMessageReactions(server, local)).toEqual(server)
  })
})
