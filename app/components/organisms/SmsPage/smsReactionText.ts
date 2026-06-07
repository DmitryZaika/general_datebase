import { SMS_MAX_TEXT } from '~/utils/phone'
import type { SmsMessage } from './types'

const REACTION_QUOTE_MAX = 120
const REACTION_SMS_PATTERN = /^(.+?)\s+to\s+"(.*)"$/s

export function normalizeSmsText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function messageTextMatchesReactionQuote(
  messageText: string,
  quotedText: string,
): boolean {
  const normalized = normalizeSmsText(messageText)
  const quote = normalizeSmsText(quotedText)
  if (normalized === quote) return true
  if (quote.endsWith('…')) {
    return normalized.startsWith(quote.slice(0, -1))
  }
  return false
}

export function parseSmsReactionMessage(
  text: string,
): { emoji: string; quotedText: string } | null {
  const match = text.match(REACTION_SMS_PATTERN)
  if (!match) return null
  const emoji = match[1].trim()
  if (emoji.length === 0 || emoji.length > 8) return null
  return { emoji, quotedText: match[2] }
}

export function isSmsReactionMessage(text: string): boolean {
  return parseSmsReactionMessage(text) !== null
}

export function filterVisibleSmsMessages(messages: SmsMessage[]): SmsMessage[] {
  return messages.filter(
    message =>
      !(message.direction === 'outbound' && isSmsReactionMessage(message.text)),
  )
}

export function collectReactionsByMessageId(
  messages: SmsMessage[],
): Record<string, string[]> {
  const inbound = messages.filter(message => message.direction === 'inbound')
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const result: Record<string, string[]> = {}

  for (const message of sorted) {
    if (message.direction !== 'outbound') continue
    const parsed = parseSmsReactionMessage(message.text)
    if (!parsed) continue

    const reactionTime = new Date(message.createdAt).getTime()
    let target: SmsMessage | undefined
    for (let i = inbound.length - 1; i >= 0; i -= 1) {
      const candidate = inbound[i]
      if (new Date(candidate.createdAt).getTime() > reactionTime) continue
      if (messageTextMatchesReactionQuote(candidate.text, parsed.quotedText)) {
        target = candidate
        break
      }
    }
    if (!target) continue

    const existing = result[target.id] ?? []
    if (!existing.includes(parsed.emoji)) {
      result[target.id] = [...existing, parsed.emoji]
    }
  }

  return result
}

export function mergeMessageReactions(
  serverReactions: Record<string, string[]>,
  localReactions: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...serverReactions }
  for (const [messageId, emojis] of Object.entries(localReactions)) {
    const existing = merged[messageId] ?? []
    const next = [...existing]
    for (const emoji of emojis) {
      if (!next.includes(emoji)) next.push(emoji)
    }
    merged[messageId] = next
  }
  return merged
}

export function buildSmsReactionMessage(emoji: string, reactedToText: string): string {
  const trimmed = reactedToText.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return emoji

  let quote = trimmed
  if (quote.length > REACTION_QUOTE_MAX) {
    quote = `${quote.slice(0, REACTION_QUOTE_MAX - 1)}…`
  }

  let message = `${emoji} to "${quote}"`
  if (message.length > SMS_MAX_TEXT) {
    const overhead = `${emoji} to ""`.length
    const maxQuote = Math.max(1, SMS_MAX_TEXT - overhead - 1)
    quote =
      trimmed.length > maxQuote
        ? `${trimmed.slice(0, maxQuote - 1)}…`
        : trimmed.slice(0, maxQuote)
    message = `${emoji} to "${quote}"`
  }

  return message
}
