import { stripSpecialOrderMarker } from '~/utils/specialOrderCalculator'

const NO_INFO_PATTERNS = [
  'do not have',
  "don't have",
  'does not have',
  'do not have specific',
  "don't have specific",
  'no specific',
  'not in the provided',
  'not in the supplier',
  'could not find',
  "couldn't find",
  'cannot find',
  "can't find",
  'no instruction for',
  'no pricing information',
  'not found in the supplier',
  'unable to find',
  'did not take any',
  "didn't take any",
  'did not use any',
  "didn't use any",
  'no information was taken',
  'i did not take',
  'i did not use',
]

function stripSourceMarker(text: string): string {
  return text.replace(/\[+\s*SOURCE\s*[:#-]?\s*[^\]]*?\s*\]+/gi, '')
}

function stripInstructionMarker(text: string): string {
  return text.replace(/\[\[INSTRUCTION:[^\]]*\]\]/gi, '')
}

function stripChatResponseMarkers(text: string): string {
  let result = stripSpecialOrderMarker(stripInstructionMarker(stripSourceMarker(text)))
  result = result.replace(
    /\*\*If yes, please provide a delivery cost and the amount of slabs\.\*\*/gi,
    '',
  )
  result = result.replace(/\n{3,}(?=Would you like me to adjust)/i, '\n\n')
  return result
}

export function stripChatResponseMarkersTrimmed(text: string): string {
  return stripChatResponseMarkers(text).trim()
}

export function parseInstructionIndex(answer: string): number | null | 'none' {
  const indices = parseInstructionIndices(answer)
  if (indices === 'none') return 'none'
  if (indices === null || indices.length === 0) return null
  return indices[0]
}

export function parseInstructionIndices(answer: string): number[] | 'none' | null {
  const match = answer.match(/\[\[INSTRUCTION:\s*([^\]]+)\]\]/i)
  if (!match) return null
  const raw = match[1].trim()
  if (raw.toLowerCase() === 'none') return 'none'
  const indices: number[] = []
  for (const part of raw.split(',')) {
    const index = Number.parseInt(part.trim(), 10)
    if (Number.isFinite(index) && index > 0 && !indices.includes(index)) {
      indices.push(index)
    }
  }
  return indices.length > 0 ? indices : null
}

export function answerHasUsableInfo(answer: string): boolean {
  const lower = answer.toLowerCase().trim()
  if (!lower) return false

  const hasPartialPriceListInfo =
    lower.includes('price is not specified') ||
    lower.includes('price is not listed') ||
    lower.includes('level is') ||
    lower.includes('group is') ||
    (lower.includes('size is') && lower.includes('not specified'))

  if (hasPartialPriceListInfo) return true

  const hasDollarPrice = /\$\s*[\d,]+(?:\.\d{2})?/.test(answer)
  const hasCloseMatchAnswer =
    lower.includes('no exact match') ||
    lower.includes('not an exact match') ||
    lower.includes('not a perfect match') ||
    lower.includes('closest match') ||
    (hasDollarPrice && lower.includes(' but '))

  if (hasCloseMatchAnswer && hasDollarPrice) return true

  return !NO_INFO_PATTERNS.some(pattern => lower.includes(pattern))
}
