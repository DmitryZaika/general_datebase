import { describe, expect, test } from 'vitest'
import type { InstructionSlim } from '~/types'
import {
  buildInstructionDisplayBlocks,
  collectImagesForAnswerInInstruction,
} from './instructionImages'

function instruction(
  id: number,
  richText: string,
  title = `Instruction ${id}`,
): InstructionSlim {
  return { id, title, rich_text: richText }
}

describe('collectImagesForAnswerInInstruction', () => {
  test('returns the image under the matched section for a simple question', () => {
    const html = `
      <p>Other Items pricing table reference.</p>
      <img src="https://example.com/table.png" />
      <p>Remnants are stored in the designated backyard area by the shop on special remnant racks.</p>
      <img src="https://example.com/remnants.png" />
    `
    const query = 'where can I find remnants'
    const answer =
      'Remnants are stored in the designated backyard area by the shop on special remnant racks.'
    const urls = collectImagesForAnswerInInstruction(instruction(1, html), answer, query)
    expect(urls).toEqual(['https://example.com/remnants.png'])
  })

  test('returns only the matched section image for a multi-paragraph answer', () => {
    const html = `
      <p>Other Items table reference.</p>
      <img src="https://example.com/table.png" />
      <p>Remnants are stored in the designated backyard area by the shop on special remnant racks.</p>
      <img src="https://example.com/remnants.png" />
      <p>Moraware is an essential tool GD salespeople use for quotes and layouts.</p>
      <img src="https://example.com/moraware.png" />
    `
    const query = 'where can I find remnants'
    const answer = `Remnants are kept in the designated backyard area by the shop on special remnant racks.
They are not stored on carts or mixed in with full slabs.
Small leftover pieces stored elsewhere are not considered remnants.`
    const urls = collectImagesForAnswerInInstruction(instruction(1, html), answer, query)
    expect(urls).toEqual(['https://example.com/remnants.png'])
  })

  test('returns only the first image directly under the matched text', () => {
    const html = `
      <p>Sink options</p>
      <img src="https://example.com/old1.png" />
      <p>Template visits cost $150 per appointment.</p>
      <img src="https://example.com/under.png" />
      <img src="https://example.com/under2.png" />
    `
    const urls = collectImagesForAnswerInInstruction(
      instruction(1, html),
      'Template visits cost $150 per appointment.',
    )
    expect(urls).toEqual(['https://example.com/under.png'])
  })

  test('returns images between matched sections for multi-part answers', () => {
    const html = `
      <p>Step one: remove old counters.</p>
      <img src="https://example.com/middle.png" />
      <p>Step two: install the new slab.</p>
    `
    const urls = collectImagesForAnswerInInstruction(
      instruction(1, html),
      'Step one remove old counters and step two install the new slab.',
    )
    expect(urls).toEqual(['https://example.com/middle.png'])
  })

  test('does not return images from unrelated sections for a single answer', () => {
    const html = `
      <p>Backsplash pricing starts at $25 per sqft.</p>
      <img src="https://example.com/backsplash.png" />
      <p>Template visits cost $150 per appointment.</p>
      <img src="https://example.com/template.png" />
    `
    const urls = collectImagesForAnswerInInstruction(
      instruction(1, html),
      'Template visits cost $150 per appointment.',
    )
    expect(urls).toEqual(['https://example.com/template.png'])
  })

  test('returns the image under the best matching paragraph for a paraphrased answer', () => {
    const html = `
      <p>Pick up projects require a signed quote.</p>
      <p>Print the drawing showing polished sides and corners.</p>
      <img src="https://example.com/corners.png" />
      <p>Important: submit paperwork to the hub.</p>
    `
    const query = 'how to do a pick up'
    const answer = `**Pick-up project process**
1. Print the quote in the correct format.
2. Have the customer sign it.
3. Submit to Paperwork Hub.
Important: Include all cutout details.`
    const urls = collectImagesForAnswerInInstruction(
      instruction(1, html, 'Pick up'),
      answer,
      query,
    )
    expect(urls).toEqual(['https://example.com/corners.png'])
  })

  test('returns all images between two phrase anchors from the user query', () => {
    const html = `
      <p>Now that you have the Customer Report, you can create the quote in Moraware. You can either create a new quote or copy an existing countertop quote. Whichever option you choose, make sure to select the C-tops with Cabinets price list.</p>
      <img src="https://example.com/price-list.png" />
      <p>Name the areas Cabinets and Countertops.</p>
      <p>All countertop pieces in the cabinet area should be shown in grey, not green. Delete all materials, colors, and edges from the Cabinets area and leave those fields blank. The only exception is when you are creating a quote with multiple cabinet options.</p>
      <img src="https://example.com/color-edge.png" />
      <p>Submit the quote when finished.</p>
    `
    const query = `continue two phrases
have the Customer Report, you can create the quote in Moraware. You can either create a new quote or c
cabinet area should be shown in grey, not green. Delete all materials, colors, and edges from the Cabinets area and leave those fields blank. The only exception is when you are creating a quo`
    const answer = `Now that you have the Customer Report, you can create the quote in Moraware. You can either create a new quote or copy an existing countertop quote. Whichever option you choose, make sure to select the "C-tops with Cabinets" price list.

All countertop pieces in the cabinet area should be shown in grey, not green. Delete all materials, colors, and edges from the "Cabinets" area and leave those fields blank. The only exception is when you are creating a quote with multiple cabinet options. In that case, you should enter the cabinet style names in the "Color" field.`
    const urls = collectImagesForAnswerInInstruction(instruction(1, html), answer, query)
    expect(urls).toEqual([
      'https://example.com/price-list.png',
      'https://example.com/color-edge.png',
    ])
  })

  test('returns all images across a multi-section cabinet answer', () => {
    const sections = Array.from({ length: 6 }, (_, index) => {
      const step = index + 1
      return `<p>Cabinets step ${step}: enter cabinet details in Moraware for area ${step}.</p><img src="https://example.com/cabinet-${step}.png" />`
    })
    const html = sections.join('\n')
    const query = 'provide all the instructions about the cabinets'
    const answer = `1. Cabinets step 1 enter cabinet details in Moraware for area 1.
2. Cabinets step 2 enter cabinet details in Moraware for area 2.
3. Cabinets step 3 enter cabinet details in Moraware for area 3.
4. Cabinets step 4 enter cabinet details in Moraware for area 4.
5. Cabinets step 5 enter cabinet details in Moraware for area 5.
6. Cabinets step 6 enter cabinet details in Moraware for area 6.`
    const urls = collectImagesForAnswerInInstruction(
      instruction(1, html, 'Cabinets in Moraware'),
      answer,
      query,
    )
    expect(urls).toEqual([
      'https://example.com/cabinet-1.png',
      'https://example.com/cabinet-2.png',
      'https://example.com/cabinet-3.png',
      'https://example.com/cabinet-4.png',
      'https://example.com/cabinet-5.png',
      'https://example.com/cabinet-6.png',
    ])
  })
})

describe('buildInstructionDisplayBlocks', () => {
  test('interleaves instruction text and images in document order', () => {
    const html = `
      <p>First step text.</p>
      <img src="https://example.com/one.png" />
      <p>Second step text.</p>
      <img src="https://example.com/two.png" />
      <p>Later section.</p>
      <img src="https://example.com/three.png" />
    `
    const blocks = buildInstructionDisplayBlocks(instruction(1, html), [
      'https://example.com/one.png',
      'https://example.com/two.png',
    ])
    expect(blocks).toEqual([
      { type: 'text', text: 'First step text.' },
      { type: 'image', url: 'https://example.com/one.png' },
      { type: 'text', text: 'Second step text.' },
      { type: 'image', url: 'https://example.com/two.png' },
    ])
  })

  test('returns only the image for a single selected screenshot', () => {
    const html = `
      <p>Template visits cost $150 per appointment.</p>
      <img src="https://example.com/template.png" />
    `
    const blocks = buildInstructionDisplayBlocks(instruction(1, html), [
      'https://example.com/template.png',
    ])
    expect(blocks).toEqual([{ type: 'image', url: 'https://example.com/template.png' }])
  })

  test('pairs each image with only its own preceding text', () => {
    const html = `
      <p>Remnants are stored in the backyard.</p>
      <img src="https://example.com/remnants.png" />
      <p>Moraware is an essential tool for quotes and layouts.</p>
      <img src="https://example.com/moraware.png" />
    `
    const blocks = buildInstructionDisplayBlocks(instruction(1, html), [
      'https://example.com/remnants.png',
      'https://example.com/moraware.png',
    ])
    expect(blocks).toEqual([
      { type: 'text', text: 'Remnants are stored in the backyard.' },
      { type: 'image', url: 'https://example.com/remnants.png' },
      { type: 'text', text: 'Moraware is an essential tool for quotes and layouts.' },
      { type: 'image', url: 'https://example.com/moraware.png' },
    ])
  })
})
