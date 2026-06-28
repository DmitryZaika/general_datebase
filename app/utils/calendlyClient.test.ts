import { describe, expect, it } from 'vitest'
import { parseCalendlySchedulingUrl } from '~/utils/calendlyUrls'

describe('parseCalendlySchedulingUrl', () => {
  it('accepts a public calendly scheduling link', () => {
    expect(
      parseCalendlySchedulingUrl('https://calendly.com/granite-manager/demo'),
    ).toBe('https://calendly.com/granite-manager/demo')
  })

  it('rejects calendly api tokens', () => {
    expect(parseCalendlySchedulingUrl('eyJraWQiOiIx.test.signature')).toBe('')
  })

  it('rejects empty values', () => {
    expect(parseCalendlySchedulingUrl('')).toBe('')
    expect(parseCalendlySchedulingUrl(null)).toBe('')
  })
})
