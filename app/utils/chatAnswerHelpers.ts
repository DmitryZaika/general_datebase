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

  return !NO_INFO_PATTERNS.some(pattern => lower.includes(pattern))
}
