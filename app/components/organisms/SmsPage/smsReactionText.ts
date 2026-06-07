import { SMS_MAX_TEXT } from '~/utils/phone'

const REACTION_QUOTE_MAX = 120

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
