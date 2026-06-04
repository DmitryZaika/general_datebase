import type { InstructionSlim } from '~/types'
import { htmlToPlainText } from '~/utils/stringHelpers'

const IMG_SRC_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'about',
  'into',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'will',
  'have',
  'has',
  'had',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'out',
  'up',
  'so',
  'if',
  'then',
  'than',
  'there',
  'please',
  'tell',
  'show',
  'give',
  'get',
  'want',
  'need',
  'know',
  'info',
  'information',
  'instruction',
  'instructions',
])

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
    .filter(term => term.length >= 3 && !STOP_WORDS.has(term))
}

function titleText(instruction: InstructionSlim): string {
  return instruction.title?.toLowerCase() ?? ''
}

function bodyText(instruction: InstructionSlim): string {
  return htmlToPlainText(instruction.rich_text).toLowerCase()
}

function countMatchingTerms(terms: string[], haystack: string): number {
  if (!haystack) return 0
  let count = 0
  for (const term of terms) {
    if (haystack.includes(term)) count += 1
  }
  return count
}

interface ScoredInstruction {
  instruction: InstructionSlim
  titleScore: number
  bodyScore: number
}

export interface MatchedInstruction {
  id: number
  title: string
}

function scoreInstructions(
  instructions: InstructionSlim[],
  query: string,
): ScoredInstruction[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  return instructions.map(instruction => ({
    instruction,
    titleScore: countMatchingTerms(terms, titleText(instruction)),
    bodyScore: countMatchingTerms(terms, bodyText(instruction)),
  }))
}

function pickBestMatches(scored: ScoredInstruction[]): InstructionSlim[] {
  if (scored.length === 0) return []

  const maxTitleScore = scored.reduce((max, item) => Math.max(max, item.titleScore), 0)

  if (maxTitleScore > 0) {
    return scored
      .filter(item => item.titleScore === maxTitleScore)
      .map(item => item.instruction)
  }

  const maxBodyScore = scored.reduce((max, item) => Math.max(max, item.bodyScore), 0)
  if (maxBodyScore === 0) return []

  return scored
    .filter(item => item.bodyScore === maxBodyScore)
    .map(item => item.instruction)
}

export function findBestMatchingInstruction(
  instructions: InstructionSlim[],
  query: string,
): MatchedInstruction | null {
  const matches = pickBestMatches(scoreInstructions(instructions, query))
  if (matches.length === 0) return null

  const instruction = matches[0]
  return {
    id: instruction.id,
    title: instruction.title?.trim() || `Instruction #${instruction.id}`,
  }
}

export function isInstructionRelatedToQuery(
  instruction: InstructionSlim,
  query: string,
): boolean {
  const terms = queryTerms(query)
  if (terms.length === 0) return false
  return (
    countMatchingTerms(terms, titleText(instruction)) > 0 ||
    countMatchingTerms(terms, bodyText(instruction)) > 0
  )
}

function imagesFrom(instructions: InstructionSlim[]): string[] {
  const urls: string[] = []
  for (const instruction of instructions) {
    for (const url of extractImageUrlsFromHtml(instruction.rich_text)) {
      if (!urls.includes(url)) {
        urls.push(url)
      }
    }
  }
  return urls
}

export function collectRelatedInstructionImages(
  instructions: InstructionSlim[],
  query: string,
): string[] {
  const scored = scoreInstructions(instructions, query)
  if (scored.length === 0) return []

  const maxTitleScore = scored.reduce((max, item) => Math.max(max, item.titleScore), 0)
  if (maxTitleScore === 0) return []

  const titleMatches = scored
    .filter(item => item.titleScore === maxTitleScore)
    .map(item => item.instruction)

  return imagesFrom(titleMatches)
}
