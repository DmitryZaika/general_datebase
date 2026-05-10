import type { Nullable } from '~/types/utils'

export interface ParsedUSAddress {
  street: string
  city?: string
  state?: string
  zip?: string
}

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
])

const STATE_ZIP_RE = /,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*(?:,\s*USA?\.?)?\s*$/

export function isUSState(code: string): boolean {
  return US_STATES.has(code)
}

export function parseUSAddress(
  raw: Nullable<string> | undefined,
): Nullable<ParsedUSAddress> {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  const match = STATE_ZIP_RE.exec(trimmed)
  if (!match || !isUSState(match[1])) return { street: trimmed }

  const [, state, zip] = match
  const before = trimmed.slice(0, match.index).trim()
  const lastComma = before.lastIndexOf(',')
  if (lastComma < 0) return { street: before, state, zip }

  return {
    street: before.slice(0, lastComma).trim(),
    city: before.slice(lastComma + 1).trim(),
    state,
    zip,
  }
}
