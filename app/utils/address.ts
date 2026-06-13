import type { ParsedAddress } from '~/services/types'

export interface ParsedUSAddress {
  street: string
  city?: string
  state?: string
  zip?: string
}

const US_STATES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
  'PR',
  'VI',
  'GU',
  'AS',
  'MP',
])

export function isUSState(code: string): boolean {
  return US_STATES.has(code)
}

export function parseAddressFromAutocompleteText(text: string): ParsedAddress {
  const zipMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/)
  const zip = zipMatch?.[1] ?? null

  const withoutCountry = text.replace(/,?\s*USA\s*$/i, '').trim()
  const parts = withoutCountry
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

  const street = parts[0] ?? text
  let city: string | null = null
  let state: string | null = null

  if (parts.length >= 3) {
    city = parts[parts.length - 2] ?? null
    const statePart = parts[parts.length - 1] ?? ''
    const stateMatch = statePart.match(/^([A-Z]{2})\b/)
    const stateCode = stateMatch?.[1]
    state = stateCode && isUSState(stateCode) ? stateCode : null
  }

  return { street, city, state, zip }
}

export function stripCountryFromAddressText(address: string): string {
  return address.replace(/,?\s*USA\s*$/i, '')
}

export function replaceZipInAddressText(address: string, zipCode: string): string {
  const withoutCountry = stripCountryFromAddressText(address).trim()
  if (!zipCode) return withoutCountry
  if (withoutCountry.includes(zipCode)) return withoutCountry
  return `${withoutCountry}, ${zipCode}`
}
