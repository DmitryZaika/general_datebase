import { describe, expect, it } from 'vitest'
import { isUSState, parseUSAddress } from './address'

describe('parseUSAddress', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseUSAddress(null)).toBeNull()
    expect(parseUSAddress(undefined)).toBeNull()
    expect(parseUSAddress('')).toBeNull()
    expect(parseUSAddress('   ')).toBeNull()
  })

  it('parses a typical Google Places US address', () => {
    expect(parseUSAddress('3333 N Tacoma Ave, Indianapolis, IN 46218, USA')).toEqual({
      street: '3333 N Tacoma Ave',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46218',
    })
  })

  it('parses ZIP+4 format', () => {
    expect(parseUSAddress('123 Main St, Indianapolis, IN 46218-1234')).toEqual({
      street: '123 Main St',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46218-1234',
    })
  })

  it('parses multi-word city correctly', () => {
    expect(parseUSAddress('123 5th Ave, New York, NY 10001, USA')).toEqual({
      street: '123 5th Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    })
  })

  it('parses street with embedded comma (apt/suite) using state+zip as anchor', () => {
    expect(parseUSAddress('PO Box 123, Apt 4, Indianapolis, IN 46218')).toEqual({
      street: 'PO Box 123, Apt 4',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46218',
    })
  })

  it('parses without trailing USA suffix', () => {
    expect(parseUSAddress('123 Main St, Boise, ID 83702')).toEqual({
      street: '123 Main St',
      city: 'Boise',
      state: 'ID',
      zip: '83702',
    })
  })

  it('falls back to street-only when format does not match', () => {
    expect(parseUSAddress('PO Box 123, Indianapolis')).toEqual({
      street: 'PO Box 123, Indianapolis',
    })
  })

  it('does not classify a non-US-shaped address as US', () => {
    // No 5-digit zip, no 2-letter state — falls through to street-only
    const result = parseUSAddress('10 Downing St, London SW1A 2AA, UK')
    expect(result?.state).toBeUndefined()
    expect(result?.zip).toBeUndefined()
  })

  it('rejects fake state codes that are not real US states', () => {
    // 'XZ' is a 2-letter pattern but not a real US state — gate should not pass
    expect(isUSState('XZ')).toBe(false)
    expect(isUSState('IN')).toBe(true)
    expect(isUSState('CA')).toBe(true)
    expect(isUSState('PR')).toBe(true) // Puerto Rico still uses CloudTalk US
    expect(isUSState('in')).toBe(false) // case-sensitive
  })

  it('trims whitespace around components', () => {
    expect(parseUSAddress('  123 Main St ,  Indianapolis , IN 46218  ')).toEqual({
      street: '123 Main St',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46218',
    })
  })
})
