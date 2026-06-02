import type { InstructionSlim } from '~/types'
import { htmlToPlainText } from '~/utils/stringHelpers'

const IMG_SRC_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi

export function extractImageUrlsFromHtml(html: string): string[] {
  const urls: string[] = []
  if (!html) return urls

  IMG_SRC_PATTERN.lastIndex = 0
  let match = IMG_SRC_PATTERN.exec(html)
  while (match) {
    const src = match[1]?.trim()
    if (src && !urls.includes(src)) {
      urls.push(src)
    }
    match = IMG_SRC_PATTERN.exec(html)
  }

  return urls
}

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter(term => term.length >= 2)
}

function instructionHaystack(instruction: InstructionSlim): string {
  const title = instruction.title?.toLowerCase() ?? ''
  const body = htmlToPlainText(instruction.rich_text).toLowerCase()
  return `${title} ${body}`
}

export function isInstructionRelatedToQuery(
  instruction: InstructionSlim,
  query: string,
): boolean {
  const terms = queryTerms(query)
  if (terms.length === 0) return false
  const haystack = instructionHaystack(instruction)
  return terms.some(term => haystack.includes(term))
}

export function collectRelatedInstructionImages(
  instructions: InstructionSlim[],
  query: string,
): string[] {
  const urls: string[] = []
  for (const instruction of instructions) {
    if (!isInstructionRelatedToQuery(instruction, query)) continue
    for (const url of extractImageUrlsFromHtml(instruction.rich_text)) {
      if (!urls.includes(url)) {
        urls.push(url)
      }
    }
  }
  return urls
}
