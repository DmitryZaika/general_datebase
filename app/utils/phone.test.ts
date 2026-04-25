import { describe, expect, it } from 'vitest'
import {
  formatPhoneForDisplay,
  formatPhoneInput,
  normalizeToE164,
  phoneDigitsOnly,
} from './phone'

describe('phoneDigitsOnly', () => {
  it('strips all non-digit characters', () => {
    expect(phoneDigitsOnly('(317) 316-1456')).toBe('3173161456')
    expect(phoneDigitsOnly('+1-317-316-1456')).toBe('13173161456')
    expect(phoneDigitsOnly('317.316.1456')).toBe('3173161456')
  })

  it('handles empty string', () => {
    expect(phoneDigitsOnly('')).toBe('')
  })

  it('preserves digits-only input', () => {
    expect(phoneDigitsOnly('13173161456')).toBe('13173161456')
  })
})

describe('normalizeToE164', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeToE164(null)).toBeNull()
    expect(normalizeToE164(undefined)).toBeNull()
    expect(normalizeToE164('')).toBeNull()
  })

  it('formats 10-digit US numbers as +1XXXXXXXXXX', () => {
    expect(normalizeToE164('317-316-1456')).toBe('+13173161456')
    expect(normalizeToE164('(317) 316-1456')).toBe('+13173161456')
    expect(normalizeToE164('3173161456')).toBe('+13173161456')
  })

  it('formats 11-digit US numbers starting with 1', () => {
    expect(normalizeToE164('13173161456')).toBe('+13173161456')
    expect(normalizeToE164('1-317-316-1456')).toBe('+13173161456')
  })

  it('preserves +-prefixed input by keeping the +', () => {
    expect(normalizeToE164('+13173161456')).toBe('+13173161456')
    expect(normalizeToE164('+44 207 183 8750')).toBe('+442071838750')
  })

  it('returns null for unparseable lengths', () => {
    expect(normalizeToE164('1456')).toBeNull()
    expect(normalizeToE164('317')).toBeNull()
    expect(normalizeToE164('123456789012345')).toBeNull()
  })

  it('handles leading/trailing whitespace', () => {
    expect(normalizeToE164('  3173161456  ')).toBe('+13173161456')
  })
})

describe('formatPhoneForDisplay', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(formatPhoneForDisplay(null)).toBe('')
    expect(formatPhoneForDisplay(undefined)).toBe('')
    expect(formatPhoneForDisplay('')).toBe('')
  })

  it('formats 10-digit US numbers with dashes', () => {
    expect(formatPhoneForDisplay('3173161456')).toBe('317-316-1456')
    expect(formatPhoneForDisplay('(317) 316-1456')).toBe('317-316-1456')
  })

  it('strips +1 from 11-digit US numbers and dashes the rest', () => {
    expect(formatPhoneForDisplay('+13173161456')).toBe('317-316-1456')
    expect(formatPhoneForDisplay('13173161456')).toBe('317-316-1456')
  })

  it('returns input unchanged for unparseable lengths (e.g. international)', () => {
    expect(formatPhoneForDisplay('+442071838750')).toBe('+442071838750')
    expect(formatPhoneForDisplay('1456')).toBe('1456')
  })
})

describe('formatPhoneInput', () => {
  it('formats 10 digits as XXX-XXX-XXXX', () => {
    expect(formatPhoneInput('3173161456')).toBe('317-316-1456')
  })

  it('formats partial 6+ digit input', () => {
    expect(formatPhoneInput('317316')).toBe('317-316-')
    expect(formatPhoneInput('3173161')).toBe('317-316-1')
  })

  it('formats partial 3+ digit input', () => {
    expect(formatPhoneInput('317')).toBe('317-')
    expect(formatPhoneInput('3173')).toBe('317-3')
  })

  it('returns short input unchanged', () => {
    expect(formatPhoneInput('31')).toBe('31')
    expect(formatPhoneInput('')).toBe('')
  })

  it('truncates input to 10 digits', () => {
    expect(formatPhoneInput('317316145678999')).toBe('317-316-1456')
  })

  it('preserves input as-is when isDeleting=true', () => {
    // user is backspacing through "317-316-145" — don't auto-reformat
    expect(formatPhoneInput('317-316-145', true)).toBe('317-316-145')
    expect(formatPhoneInput('317-316-', true)).toBe('317-316-')
  })

  it('strips non-digit/non-dash characters when isDeleting=true', () => {
    expect(formatPhoneInput('317abc-316', true)).toBe('317-316')
  })
})
