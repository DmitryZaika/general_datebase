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
]

function stripSourceMarker(text: string): string {
  return text.replace(/\[+\s*SOURCE\s*[:#-]?\s*[^\]]*?\s*\]+/gi, '')
}

function stripChatResponseMarkers(text: string): string {
  let result = stripSpecialOrderMarker(stripSourceMarker(text))
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

export function isInstructionFollowUp(query: string): boolean {
  const lower = query.toLowerCase().trim()
  return (
    lower.includes('previous') ||
    lower.includes('previos') ||
    lower.includes('prior') ||
    lower.includes('you said') ||
    lower.includes('i mentioned') ||
    lower.includes('i said') ||
    lower.includes('did i') ||
    lower.includes('how many') ||
    lower.includes('what did') ||
    lower.includes('can you see') ||
    lower.includes('see the text') ||
    lower.includes('see the chat') ||
    lower.includes('in the chat') ||
    lower.includes('above') ||
    lower.includes('before') ||
    lower.startsWith('yes') ||
    lower.startsWith('no') ||
    lower.includes('slabs') ||
    lower.includes('delivery')
  )
}

export function looksLikeInstructionQuery(query: string): boolean {
  const lower = query.toLowerCase().trim()
  return (
    lower.includes('how do') ||
    lower.includes('how to') ||
    lower.includes('instruction') ||
    lower.includes('tell me about') ||
    lower.includes('explain') ||
    lower.includes('what is the process') ||
    lower.includes('what are the steps') ||
    lower.includes('fill out') ||
    lower.includes('handbook') ||
    lower.includes('contract') ||
    lower.includes('cabinet') ||
    lower.includes('lead') ||
    lower.includes('quote') ||
    lower.includes('customer') ||
    lower.includes('salesrep') ||
    lower.includes('walk-in') ||
    lower.includes('walk in')
  )
}

export function shouldAttachInstructionLink(
  query: string,
  isNewChat: boolean,
): boolean {
  if (isNewChat) return true
  if (isInstructionFollowUp(query)) return false
  return looksLikeInstructionQuery(query)
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
