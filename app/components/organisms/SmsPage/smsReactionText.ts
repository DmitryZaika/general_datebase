import { SMS_MAX_TEXT } from '~/utils/phone'
import type { SmsMessage } from './types'

const REACTION_QUOTE_MAX = 120
const REACTION_SMS_PATTERN = /^(.+?)\s+to\s+["'“”‘'](.+?)["'“”‘']$/su
const REACTION_TO_UNQUOTED_PATTERN = /^(.+?)\s+to\s+(\S.+)$/su
const REACTION_LOOSE_PATTERN = /\s+to\s+["'“”‘'].+["'“”‘']\s*$/su
const IMESSAGE_TAPBACK_PATTERN =
  /^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned)\s+["'“”‘'](.+?)["'“”‘']$/iu
const REACTION_REMOVAL_PATTERN = /^Removed\s+(.+?)\s+from\s+["'“”‘'](.+?)["'“”‘']$/su
const REACTION_REMOVAL_LOOSE_PATTERN = /^Removed\s+.+\s+from\s+["'“”‘'].+["'“”‘']\s*$/su

const REACTION_LABEL_TO_EMOJI: Record<string, string> = {
  cool: '😎',
  liked: '👍',
  loved: '❤️',
  laughed: '😂',
  'laughed at': '😂',
  emphasized: '‼️',
  questioned: '❓',
  disliked: '👎',
}

export function normalizeSmsText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function normalizeReactionLabel(label: string): string {
  return normalizeSmsText(label)
    .replace(/^[''"]+|[''"]+$/g, '')
    .toLowerCase()
}

export function normalizeReactionDisplay(label: string): string {
  const normalized = normalizeReactionLabel(label)
  return REACTION_LABEL_TO_EMOJI[normalized] ?? label.trim()
}

function isCustomerWordTapback(label: string): boolean {
  const normalized = normalizeReactionLabel(label)
  return normalized in REACTION_LABEL_TO_EMOJI
}

export function unwrapReactionQuotedText(quotedText: string): string {
  const normalized = normalizeSmsText(quotedText)
  const nested = parseSmsReactionMessage(normalized)
  if (nested) return unwrapReactionQuotedText(nested.quotedText)
  return normalized
}

export function messageTextMatchesReactionQuote(
  messageText: string,
  quotedText: string,
): boolean {
  const normalized = normalizeSmsText(messageText)
  const quote = unwrapReactionQuotedText(quotedText)
  if (normalized === quote) return true
  if (normalized.toLowerCase() === quote.toLowerCase()) return true
  if (quote.endsWith('…')) {
    return (
      normalized.startsWith(quote.slice(0, -1)) ||
      normalized.toLowerCase().startsWith(quote.slice(0, -1).toLowerCase())
    )
  }
  return false
}

export function messageReactionTextKey(text: string): string {
  return normalizeSmsText(text).toLowerCase()
}

export function getReactionsForMessage(
  message: SmsMessage,
  reactions: Record<string, string[]>,
): string[] {
  const textKey = `text:${messageReactionTextKey(message.text)}`
  const raw =
    message.id in reactions ? reactions[message.id] : (reactions[textKey] ?? [])
  const displayed: string[] = []
  for (const label of raw) {
    const emoji = normalizeReactionDisplay(label)
    if (!displayed.includes(emoji)) displayed.push(emoji)
  }
  return displayed
}

export function addReactionToMap(
  map: Record<string, string[]>,
  messageId: string,
  messageText: string,
  emoji: string,
): Record<string, string[]> {
  const next = { ...map }
  for (const key of [messageId, `text:${messageReactionTextKey(messageText)}`]) {
    const current = next[key] ?? []
    if (current.includes(emoji)) continue
    next[key] = [...current, emoji]
  }
  return next
}

function pruneEmptyReactionKey(map: Record<string, string[]>, key: string): void {
  if (!(key in map)) return
  if (map[key].length === 0) {
    delete map[key]
  }
}

export function removeReactionFromMap(
  map: Record<string, string[]>,
  conversationMessages: SmsMessage[],
  quotedText: string,
  emoji: string,
): Record<string, string[]> {
  const next = { ...map }
  const textKey = `text:${messageReactionTextKey(unwrapReactionQuotedText(quotedText))}`

  if (textKey in next) {
    next[textKey] = next[textKey].filter(item => item !== emoji)
    pruneEmptyReactionKey(next, textKey)
  }

  for (const candidate of conversationMessages) {
    if (!messageTextMatchesReactionQuote(candidate.text, quotedText)) continue
    if (!(candidate.id in next)) continue
    next[candidate.id] = next[candidate.id].filter(item => item !== emoji)
    pruneEmptyReactionKey(next, candidate.id)
  }

  return next
}

export function setLocalReactionsForMessage(
  map: Record<string, string[]>,
  messageId: string,
  _messageText: string,
  emojis: string[],
): Record<string, string[]> {
  return { ...map, [messageId]: [...emojis] }
}

export function parseSmsReactionMessage(
  text: string,
): { emoji: string; quotedText: string } | null {
  const trimmed = text.trim()

  const imessage = trimmed.match(IMESSAGE_TAPBACK_PATTERN)
  if (imessage) {
    const emoji = imessage[1].trim()
    const quotedText = imessage[2].trim()
    if (emoji.length === 0 || quotedText.length === 0) return null
    return { emoji, quotedText }
  }

  const strict = trimmed.match(REACTION_SMS_PATTERN)
  if (strict) {
    const emoji = strict[1].trim()
    const quotedText = strict[2].trim()
    if (emoji.length === 0 || quotedText.length === 0) return null
    return { emoji, quotedText }
  }

  const unquoted = trimmed.match(REACTION_TO_UNQUOTED_PATTERN)
  if (unquoted) {
    const emoji = unquoted[1].trim()
    const quotedText = unquoted[2].trim()
    if (emoji.length === 0 || quotedText.length === 0) return null
    if (!isCustomerWordTapback(emoji) && !/\p{Extended_Pictographic}/u.test(emoji)) {
      return null
    }
    return { emoji, quotedText }
  }

  if (!REACTION_LOOSE_PATTERN.test(trimmed)) return null
  const toMatch = trimmed.match(/\s+to\s+["'“”‘']/)
  if (!toMatch || toMatch.index === undefined || toMatch.index <= 0) return null
  const emoji = trimmed.slice(0, toMatch.index).trim()
  if (emoji.length === 0) return null
  const quoteMatch = trimmed.match(/["'“”‘'](.+?)["'“”‘']\s*$/su)
  if (!quoteMatch) return null
  return { emoji, quotedText: quoteMatch[1].trim() }
}

export function parseSmsReactionRemovalMessage(
  text: string,
): { emoji: string; quotedText: string } | null {
  const trimmed = text.trim()
  const strict = trimmed.match(REACTION_REMOVAL_PATTERN)
  if (strict) {
    const emoji = strict[1].trim()
    if (emoji.length === 0) return null
    return { emoji, quotedText: strict[2].trim() }
  }

  if (!REACTION_REMOVAL_LOOSE_PATTERN.test(trimmed)) return null
  const fromMatch = trimmed.match(/\s+from\s+["'“”‘']/)
  if (!fromMatch || fromMatch.index === undefined || fromMatch.index <= 0) return null
  const prefix = trimmed.slice(0, fromMatch.index).trim()
  if (!prefix.startsWith('Removed')) return null
  const emoji = prefix.slice('Removed'.length).trim()
  if (emoji.length === 0) return null
  const quoteMatch = trimmed.match(/["'“”‘'](.+?)["'“”‘']\s*$/su)
  if (!quoteMatch) return null
  return { emoji, quotedText: quoteMatch[1].trim() }
}

export function isSmsReactionMessage(text: string): boolean {
  const trimmed = text.trim()
  if (parseSmsReactionMessage(trimmed) !== null) return true
  if (parseSmsReactionRemovalMessage(trimmed) !== null) return true
  if (IMESSAGE_TAPBACK_PATTERN.test(trimmed)) return true
  return REACTION_LOOSE_PATTERN.test(trimmed)
}

function findReactionTargetMessage(
  conversationMessages: SmsMessage[],
  quotedText: string,
  reactionTime: number,
  reactionDirection: SmsMessage['direction'],
  reactionLabel?: string,
): SmsMessage | undefined {
  const preferredDirection =
    reactionLabel && isCustomerWordTapback(reactionLabel)
      ? 'outbound'
      : reactionDirection === 'inbound'
        ? 'outbound'
        : 'inbound'

  for (let i = conversationMessages.length - 1; i >= 0; i -= 1) {
    const candidate = conversationMessages[i]
    if (new Date(candidate.createdAt).getTime() > reactionTime) continue
    if (candidate.direction !== preferredDirection) continue
    if (messageTextMatchesReactionQuote(candidate.text, quotedText)) {
      return candidate
    }
  }

  for (let i = conversationMessages.length - 1; i >= 0; i -= 1) {
    const candidate = conversationMessages[i]
    if (new Date(candidate.createdAt).getTime() > reactionTime) continue
    if (messageTextMatchesReactionQuote(candidate.text, quotedText)) {
      return candidate
    }
  }

  return undefined
}

export function filterVisibleSmsMessages(messages: SmsMessage[]): SmsMessage[] {
  return messages.filter(message => !isSmsReactionMessage(message.text))
}

export function collectReactionsByMessageId(
  messages: SmsMessage[],
): Record<string, string[]> {
  const conversationMessages = messages.filter(
    message => !isSmsReactionMessage(message.text),
  )
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  let result: Record<string, string[]> = {}

  for (const message of sorted) {
    const reactionTime = new Date(message.createdAt).getTime()
    const removal = parseSmsReactionRemovalMessage(message.text)
    if (removal) {
      const target = findReactionTargetMessage(
        conversationMessages,
        removal.quotedText,
        reactionTime,
        message.direction,
        removal.emoji,
      )
      if (!target) continue
      result = removeReactionFromMap(
        result,
        conversationMessages,
        removal.quotedText,
        removal.emoji,
      )
      continue
    }

    const parsed = parseSmsReactionMessage(message.text)
    if (!parsed) continue

    const target = findReactionTargetMessage(
      conversationMessages,
      parsed.quotedText,
      reactionTime,
      message.direction,
      parsed.emoji,
    )
    if (!target) continue

    result = addReactionToMap(result, target.id, target.text, parsed.emoji)
  }

  return result
}

export function mergeMessageReactions(
  serverReactions: Record<string, string[]>,
  localReactions: Record<string, string[]>,
): Record<string, string[]> {
  const merged = { ...serverReactions }

  for (const [key, emojis] of Object.entries(localReactions)) {
    const serverEmojis = serverReactions[key] ?? []
    if (emojis.length === 0 && serverEmojis.length > 0) {
      continue
    }
    if (emojis.length === 0) {
      delete merged[key]
      continue
    }
    merged[key] = emojis
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

export function buildSmsReactionRemovalMessage(
  emoji: string,
  reactedToText: string,
): string {
  const trimmed = reactedToText.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return `Removed ${emoji}`

  let quote = trimmed
  if (quote.length > REACTION_QUOTE_MAX) {
    quote = `${quote.slice(0, REACTION_QUOTE_MAX - 1)}…`
  }

  let message = `Removed ${emoji} from "${quote}"`
  if (message.length > SMS_MAX_TEXT) {
    const overhead = `Removed ${emoji} from ""`.length
    const maxQuote = Math.max(1, SMS_MAX_TEXT - overhead - 1)
    quote =
      trimmed.length > maxQuote
        ? `${trimmed.slice(0, maxQuote - 1)}…`
        : trimmed.slice(0, maxQuote)
    message = `Removed ${emoji} from "${quote}"`
  }

  return message
}
