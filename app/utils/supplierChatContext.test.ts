import { describe, expect, it } from 'vitest'
import { extractPriceListExcerpt } from './supplierChatContext.server'

function buildMockMsiText() {
  const filler = 'Other product row '.repeat(500)
  return [
    'Group 1',
    'Small section',
    '$10.00',
    'Group 2',
    'Medium section'.repeat(50),
    '$15.00',
    'Group 3',
    'Calacatta Idillio BM 127x64 to 140x82',
    filler,
    'New Calacatta Laza',
    '$19.62',
    'Group 4',
    'Next group',
  ].join('\n')
}

describe('extractPriceListExcerpt', () => {
  it('includes group price tail for matching product', () => {
    const text = buildMockMsiText()
    const excerpt = extractPriceListExcerpt(text, 'Calacatta Idillio BM group 3', 6000)
    expect(excerpt).toContain('Calacatta Idillio BM')
    expect(excerpt).toContain('$19.62')
    expect(excerpt).not.toContain('Group 1')
  })

  it('annotates short group sections with slab price', () => {
    const text = 'Group 1\nProduct $5.00'
    const excerpt = extractPriceListExcerpt(text, 'Product', 6000)
    expect(excerpt).toContain('GROUP 1 SLAB PRICE: $5.00')
    expect(excerpt).toContain('Product $5.00')
  })

  it('selects group by number when product terms are missing', () => {
    const text = buildMockMsiText()
    const excerpt = extractPriceListExcerpt(text, 'MSI level 3 price', 6000)
    expect(excerpt).toContain('Group 3')
    expect(excerpt).toContain('$19.62')
  })

  it('prefers priced group section when group headers repeat', () => {
    const filler = 'Other product row '.repeat(400)
    const pricedGroup3 = [
      'Group 3',
      'Calacatta Idillio BM 127x64 to 140x82',
      filler,
      'New Calacatta Laza',
      '$19.62',
    ].join('\n')
    const unpricedGroup3 = [
      'Group 3',
      'Calacatta Idillio 127x64',
      'Calacatta Adonia 130x79',
      'Calacatta Classique 127x64',
      'footer notes without prices',
    ].join('\n')
    const text = ['Group 1', '$10.00', pricedGroup3, 'Group 4', unpricedGroup3].join(
      '\n',
    )
    const excerpt = extractPriceListExcerpt(
      text,
      'Calacatta Idillio from MSI Surfaces',
      6000,
    )
    expect(excerpt).toContain('$19.62')
    expect(excerpt).not.toContain('footer notes without prices')
  })

  it('matches misspelled product names like Idilio to Idillio', () => {
    const text = [
      'Group 3',
      'Calacatta Idillio BM 127x64 to 140x82',
      'New Calacatta Laza',
      '$19.62',
      'Group 8',
      'Calacatta Viraldi 137x79',
      '$31.16',
    ].join('\n')
    const excerpt = extractPriceListExcerpt(text, 'Calacatta Idilio MSI Surfaces', 6000)
    expect(excerpt).toContain('Idillio')
    expect(excerpt).toContain('GROUP 3 SLAB PRICE')
    expect(excerpt).toContain('$19.62')
    expect(excerpt).not.toContain('Viraldi')
  })
})
