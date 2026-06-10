import { describe, expect, it } from 'vitest'
import { htmlToPlainText } from './stringHelpers'

describe('htmlToPlainText', () => {
  it('preserves link URLs from anchor tags', () => {
    const html =
      '<p>Account name: Granite Depot</p><p><a href="https://www.prokitchensoftware.com/program-downloads/" rel="noopener noreferrer" target="_blank">Download Prokitchen (cabinet software)</a></p>'
    const text = htmlToPlainText(html)
    expect(text).toContain('Download Prokitchen (cabinet software)')
    expect(text).toContain('https://www.prokitchensoftware.com/program-downloads/')
  })

  it('keeps bare URL when link text matches href', () => {
    const html = '<a href="https://example.com">https://example.com</a>'
    expect(htmlToPlainText(html)).toBe('https://example.com')
  })

  it('decodes entities in href values', () => {
    const html = '<a href="https://example.com?foo=1&amp;bar=2">Guide</a>'
    expect(htmlToPlainText(html)).toBe('Guide (https://example.com?foo=1&bar=2)')
  })
})
