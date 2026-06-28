import { describe, expect, it } from 'vitest'
import { calculateMonthlyPrice } from '~/utils/graniteManagerPricing'

describe('calculateMonthlyPrice', () => {
  it('charges $300 for up to 10 users', () => {
    expect(calculateMonthlyPrice(1)).toBe(300)
    expect(calculateMonthlyPrice(10)).toBe(300)
  })

  it('charges $330 for 11 users', () => {
    expect(calculateMonthlyPrice(11)).toBe(330)
  })

  it('adds $30 per user beyond 10', () => {
    expect(calculateMonthlyPrice(12)).toBe(360)
    expect(calculateMonthlyPrice(15)).toBe(450)
  })
})
