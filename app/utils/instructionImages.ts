import type { InstructionSlim } from '~/types'
import {
  parseInstructionIndices,
  stripChatResponseMarkersTrimmed,
} from '~/utils/chatAnswerHelpers'
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

const PRICE_SIGNAL_TERMS = [
  'price',
  'prices',
  'cost',
  'costs',
  'fee',
  'fees',
  'rate',
  'rates',
  'charge',
  'charges',
  'fabrication',
  'pricing',
  'sqft',
  'sqft',
]

function isPriceQuery(query: string): boolean {
  const lower = query.toLowerCase()
  return PRICE_SIGNAL_TERMS.some(term => lower.includes(term))
}

export { isPriceQuery }

function hasPricingInBody(body: string): boolean {
  return /\$\s*\d/.test(body) || /(?:per|\/)\s*sq\.?\s*ft/.test(body)
}

function scorePriceRelevance(instruction: InstructionSlim, terms: string[]): number {
  const body = bodyText(instruction)
  if (!hasPricingInBody(body)) return 0
  let score = countMatchingTerms(terms, body)
  if (terms.some(term => term.includes('fabric')) && body.includes('fabrication')) {
    score += 2
  }
  return score
}

function pickBestMatches(
  scored: ScoredInstruction[],
  query: string,
): InstructionSlim[] {
  if (scored.length === 0) return []

  if (isPriceQuery(query)) {
    const terms = queryTerms(query)
    const withPriceScore = scored.map(item => ({
      item,
      priceScore: scorePriceRelevance(item.instruction, terms),
    }))
    const maxPriceScore = withPriceScore.reduce(
      (max, entry) => Math.max(max, entry.priceScore),
      0,
    )
    if (maxPriceScore > 0) {
      return withPriceScore
        .filter(entry => entry.priceScore === maxPriceScore)
        .map(entry => entry.item.instruction)
    }
  }

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

export function findInstructionsMatchingQueryTitle(
  instructions: InstructionSlim[],
  query: string,
): MatchedInstruction[] {
  const scored = scoreInstructions(instructions, query)
  const maxTitleScore = scored.reduce((max, item) => Math.max(max, item.titleScore), 0)
  if (maxTitleScore === 0) return []

  return scored
    .filter(item => item.titleScore === maxTitleScore)
    .map(item => ({
      id: item.instruction.id,
      title: item.instruction.title?.trim() || `Instruction #${item.instruction.id}`,
    }))
}

function toMatchedInstruction(instruction: InstructionSlim): MatchedInstruction {
  return {
    id: instruction.id,
    title: instruction.title?.trim() || `Instruction #${instruction.id}`,
  }
}

export function resolveInstructionsUsedForReply(
  instructions: InstructionSlim[],
  answer: string,
  query: string,
): MatchedInstruction[] {
  const parsed = parseInstructionIndices(answer)
  if (parsed === 'none' || parsed === null || parsed.length === 0) return []

  const cleanAnswer = stripChatResponseMarkersTrimmed(answer)
  const scoreText = cleanAnswer.length > 0 ? `${query}\n${cleanAnswer}` : query
  const scored = scoreInstructions(instructions, scoreText)
  const byInstruction = new Map(scored.map(item => [item.instruction, item]))

  const maxTitleScore = scored.reduce((max, item) => Math.max(max, item.titleScore), 0)
  const maxBodyScore = scored.reduce((max, item) => Math.max(max, item.bodyScore), 0)
  const hasBodyEvidence = maxBodyScore >= 3

  const isTitleStrong = (item: ScoredInstruction): boolean =>
    maxTitleScore > 0 && item.titleScore === maxTitleScore

  const isBodyStrong = (item: ScoredInstruction): boolean =>
    hasBodyEvidence && item.bodyScore >= Math.max(3, Math.ceil(maxBodyScore * 0.6))

  const result: MatchedInstruction[] = []
  const seen = new Set<number>()
  const add = (instruction: InstructionSlim) => {
    if (seen.has(instruction.id)) return
    seen.add(instruction.id)
    result.push(toMatchedInstruction(instruction))
  }

  for (const index of parsed) {
    const instruction = instructions[index - 1]
    if (!instruction) continue
    const item = byInstruction.get(instruction)
    if (!item) continue
    if (isPriceQuery(query)) {
      const terms = queryTerms(query)
      if (scorePriceRelevance(instruction, terms) > 0) {
        add(instruction)
        continue
      }
    }
    const acceptable = hasBodyEvidence
      ? isBodyStrong(item)
      : isTitleStrong(item) || item.bodyScore >= 2
    if (!acceptable) continue
    add(instruction)
  }

  return result
}

export function buildPriceQueryHint(
  instructions: InstructionSlim[],
  query: string,
): string {
  if (!isPriceQuery(query)) return ''
  const scored = scoreInstructions(instructions, query)
  const matches = pickBestMatches(scored, query)
  if (matches.length === 0) return ''

  const match = matches[0]
  const index = instructions.findIndex(item => item.id === match.id)
  if (index < 0) return ''
  return `PRICE QUERY: Check Instruction ${index + 1} first — its body contains pricing relevant to this question.\n\n`
}

export function findBestMatchingInstruction(
  instructions: InstructionSlim[],
  query: string,
): MatchedInstruction | null {
  const matches = pickBestMatches(scoreInstructions(instructions, query), query)
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

export function collectImagesForMatchedInstructions(
  instructions: InstructionSlim[],
  matched: MatchedInstruction[],
): string[] {
  if (matched.length === 0) return []

  const byId = new Map(instructions.map(instruction => [instruction.id, instruction]))
  const picked: InstructionSlim[] = []
  for (const match of matched) {
    const instruction = byId.get(match.id)
    if (instruction) picked.push(instruction)
  }
  return imagesFrom(picked)
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

export type InstructionDisplayBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }

const IMG_TAG_SPLIT_PATTERN = /(<img\b[^>]*>)/gi
const IMG_TAG_TEST_PATTERN = /^<img\b/i
const MIN_MATCH_TOKEN_LENGTH = 4
const MAX_MATCH_GAP = 1

function extractImgSrc(tag: string): string {
  const match = tag.match(/\bsrc=["']([^"']+)["']/i)
  return match ? match[1].trim() : ''
}

function parseInstructionBlocks(html: string): InstructionDisplayBlock[] {
  if (!html) return []
  const blocks: InstructionDisplayBlock[] = []
  for (const segment of html.split(IMG_TAG_SPLIT_PATTERN)) {
    if (!segment) continue
    if (IMG_TAG_TEST_PATTERN.test(segment)) {
      const url = extractImgSrc(segment)
      if (url) blocks.push({ type: 'image', url })
      continue
    }
    const text = htmlToPlainText(segment)
    if (!text) continue
    for (const line of text.split(/\n+/)) {
      const trimmed = line.trim()
      if (trimmed) blocks.push({ type: 'text', text: trimmed })
    }
  }
  return blocks
}

function matchTokens(text: string): string[] {
  const tokens: string[] = []
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= MIN_MATCH_TOKEN_LENGTH && !STOP_WORDS.has(raw)) {
      tokens.push(raw)
    }
  }
  return tokens
}

function blockMatchStrength(blockText: string, queryTokens: Set<string>): number {
  const tokens = matchTokens(blockText)
  if (tokens.length === 0) return 0

  const unique = new Set(tokens)
  let shared = 0
  for (const token of unique) {
    if (queryTokens.has(token)) shared += 1
  }
  if (shared >= 2) return shared
  if (shared >= 1 && shared / unique.size >= 0.5) return shared
  return 0
}

interface TextBlockMatch {
  blockIndex: number
  textOrdinal: number
  strength: number
}

function selectMatchedCluster(matched: TextBlockMatch[]): TextBlockMatch[] {
  if (matched.length === 0) return []

  let strongest = 0
  for (let index = 1; index < matched.length; index++) {
    if (matched[index].strength > matched[strongest].strength) strongest = index
  }

  let start = strongest
  let end = strongest
  while (
    end + 1 < matched.length &&
    matched[end + 1].textOrdinal - matched[end].textOrdinal - 1 <= MAX_MATCH_GAP
  ) {
    end += 1
  }
  while (
    start - 1 >= 0 &&
    matched[start].textOrdinal - matched[start - 1].textOrdinal - 1 <= MAX_MATCH_GAP
  ) {
    start -= 1
  }
  return matched.slice(start, end + 1)
}

export function collectImagesForAnswerInInstruction(
  instruction: InstructionSlim,
  answer: string,
  query?: string,
): string[] {
  const blocks = parseInstructionBlocks(instruction.rich_text)
  if (blocks.length === 0) return []

  const queryTokens = new Set(matchTokens(`${answer}\n${query ?? ''}`))
  if (queryTokens.size === 0) return []

  const matched: TextBlockMatch[] = []
  let textOrdinal = 0
  blocks.forEach((block, index) => {
    if (block.type !== 'text') return
    const strength = blockMatchStrength(block.text, queryTokens)
    if (strength > 0) matched.push({ blockIndex: index, textOrdinal, strength })
    textOrdinal += 1
  })
  if (matched.length === 0) return []

  const cluster = selectMatchedCluster(matched)
  if (cluster.length === 0) return []

  const firstMatched = cluster[0].blockIndex
  const lastMatched = cluster[cluster.length - 1].blockIndex

  const urls: string[] = []
  const pushUrl = (url: string) => {
    if (url && !urls.includes(url)) urls.push(url)
  }

  for (let index = firstMatched + 1; index < lastMatched; index++) {
    const block = blocks[index]
    if (block.type === 'image') pushUrl(block.url)
  }

  const trailing = blocks[lastMatched + 1]
  if (trailing && trailing.type === 'image') pushUrl(trailing.url)

  return urls
}

export function collectImagesForUsedInstructions(
  instructions: InstructionSlim[],
  matched: MatchedInstruction[],
  answer: string,
  query: string,
): string[] {
  if (matched.length === 0) return []

  const byId = new Map(instructions.map(instruction => [instruction.id, instruction]))
  const urls: string[] = []
  for (const match of matched) {
    const instruction = byId.get(match.id)
    if (!instruction) continue
    for (const url of collectImagesForAnswerInInstruction(instruction, answer, query)) {
      if (!urls.includes(url)) urls.push(url)
    }
  }
  return urls
}

const MIN_CONTENT_MATCH_TOKENS = 5
const CONTENT_MATCH_COVERAGE = 0.75

export function findInstructionMatchingAnswer(
  instructions: InstructionSlim[],
  answer: string,
  query: string,
): MatchedInstruction | null {
  const answerTokens = new Set(matchTokens(`${answer}\n${query}`))
  if (answerTokens.size < MIN_CONTENT_MATCH_TOKENS) return null

  let best: { instruction: InstructionSlim; coverage: number } | null = null
  for (const instruction of instructions) {
    const bodyTokens = new Set(matchTokens(bodyText(instruction)))
    if (bodyTokens.size === 0) continue

    let covered = 0
    for (const token of answerTokens) {
      if (bodyTokens.has(token)) covered += 1
    }
    const coverage = covered / answerTokens.size
    if (!best || coverage > best.coverage) {
      best = { instruction, coverage }
    }
  }

  if (!best || best.coverage < CONTENT_MATCH_COVERAGE) return null
  return toMatchedInstruction(best.instruction)
}

export function buildInstructionDisplayBlocks(
  instruction: InstructionSlim,
  selectedUrls: string[],
): InstructionDisplayBlock[] {
  const blocks = parseInstructionBlocks(instruction.rich_text)
  if (blocks.length === 0) return []

  const selected = new Set(selectedUrls)
  const selectedImageIndexes: number[] = []
  blocks.forEach((block, index) => {
    if (block.type === 'image' && selected.has(block.url)) {
      selectedImageIndexes.push(index)
    }
  })

  if (selectedImageIndexes.length === 0) return []
  if (selectedImageIndexes.length === 1) {
    const block = blocks[selectedImageIndexes[0]]
    return block.type === 'image' ? [{ type: 'image', url: block.url }] : []
  }

  const result: InstructionDisplayBlock[] = []
  let lastEmittedTextIndex = -1
  for (const imageIndex of selectedImageIndexes) {
    let precedingTextIndex = -1
    for (let index = imageIndex - 1; index >= 0; index--) {
      if (blocks[index].type === 'text') {
        precedingTextIndex = index
        break
      }
    }
    if (precedingTextIndex !== -1 && precedingTextIndex !== lastEmittedTextIndex) {
      const textBlock = blocks[precedingTextIndex]
      if (textBlock.type === 'text') {
        result.push({ type: 'text', text: textBlock.text })
        lastEmittedTextIndex = precedingTextIndex
      }
    }
    const imageBlock = blocks[imageIndex]
    if (imageBlock.type === 'image') {
      result.push({ type: 'image', url: imageBlock.url })
    }
  }
  return result
}
