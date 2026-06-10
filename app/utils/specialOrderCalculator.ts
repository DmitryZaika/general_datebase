export interface SpecialOrderInput {
  pricePerSqft: number
  lengthInches: number
  widthInches: number
  slabs: number
  deliveryCost: number
  taxRate: number
}

export interface SpecialOrderResult {
  totalSquareFeet: number
  materialCost: number
  totalCost: number
  costPerSqftWithDelivery: number
}

export interface SpecialOrderOffer {
  pricePerSqft: number
  lengthInches: number
  widthInches: number
}

const SPECIAL_ORDER_MARKER_RE = /\[+\s*SPECIAL\s*_?\s*ORDER\s*[:#-]?\s*([^\]]*?)\s*\]+/i

export function calculateSpecialOrder(input: SpecialOrderInput): SpecialOrderResult {
  const areaPerSlab = (input.widthInches * input.lengthInches) / 144
  const totalSquareFeet = areaPerSlab * input.slabs
  const materialCost =
    areaPerSlab * input.pricePerSqft * input.slabs * (1 + input.taxRate)
  const totalCost = materialCost + input.deliveryCost
  const costPerSqftWithDelivery = totalSquareFeet ? totalCost / totalSquareFeet : 0

  return {
    totalSquareFeet,
    materialCost,
    totalCost,
    costPerSqftWithDelivery,
  }
}

export function formatSpecialOrderResult(
  input: SpecialOrderInput,
  result: SpecialOrderResult,
): string {
  const taxPercent = (input.taxRate * 100).toFixed(2).replace(/\.?0+$/, '')
  return [
    `Price per sqft (with tax & delivery): $${result.costPerSqftWithDelivery.toFixed(2)}`,
    `Total square feet: ${result.totalSquareFeet.toFixed(2)} sqft`,
    `Material cost (incl. ${taxPercent}% tax): $${result.materialCost.toFixed(2)}`,
    `Total cost: $${result.totalCost.toFixed(2)}`,
  ].join('\n')
}

export function isSpecialOrderQuoteContent(content: string): boolean {
  return content.trimStart().startsWith('Price per sqft (with tax & delivery):')
}

export function parseSpecialOrderMarker(text: string): SpecialOrderOffer | null {
  const match = text.match(SPECIAL_ORDER_MARKER_RE)
  if (!match) return null

  const params = new Map<string, string>()
  for (const part of match[1].split(',')) {
    const [key, value] = part.split('=').map(item => item.trim())
    if (key && value) params.set(key.toLowerCase(), value)
  }

  const pricePerSqft = Number.parseFloat(params.get('price') ?? '')
  const lengthInches = Number.parseFloat(params.get('length') ?? '')
  const widthInches = Number.parseFloat(params.get('width') ?? '')

  if (
    !Number.isFinite(pricePerSqft) ||
    !Number.isFinite(lengthInches) ||
    !Number.isFinite(widthInches) ||
    pricePerSqft <= 0 ||
    lengthInches <= 0 ||
    widthInches <= 0
  ) {
    return null
  }

  return { pricePerSqft, lengthInches, widthInches }
}

export function inferSpecialOrderOfferFromAnswer(
  text: string,
): SpecialOrderOffer | null {
  const fromMarker = parseSpecialOrderMarker(text)
  if (fromMarker) return fromMarker

  const cleaned = stripSpecialOrderMarker(text)
    .replace(/\[+\s*SOURCE\s*[:#-]?\s*[^\]]*?\s*\]+/gi, '')
    .replace(/\*\*/g, '')

  const dimMatch =
    cleaned.match(/(\d{2,3})\s*[×xX]\s*(\d{2,3})/) ??
    cleaned.match(/(\d{2,3})\s*(?:inch|in)?(?:es)?\s*[×xX]\s*(\d{2,3})/i)

  if (!dimMatch) return null

  const lengthInches = Number.parseFloat(dimMatch[1])
  const widthInches = Number.parseFloat(dimMatch[2])
  if (!Number.isFinite(lengthInches) || !Number.isFinite(widthInches)) return null
  if (lengthInches <= 0 || widthInches <= 0) return null

  const priceMatch = cleaned.match(/\$\s*([\d,]+(?:\.\d{2})?)/)
  if (!priceMatch) return null

  const rawPrice = Number.parseFloat(priceMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null

  const lower = cleaned.toLowerCase()
  const areaPerSlab = (lengthInches * widthInches) / 144
  if (areaPerSlab <= 0) return null

  const isPerSlab = /\bper\s+(?:loose\s+)?slab\b/.test(lower)
  const isPerSqft = /\bper\s+(?:sq\.?\s*ft|square\s*foot|sf)\b/.test(lower)

  let pricePerSqft = rawPrice
  if (isPerSlab && !isPerSqft) {
    const convertedPerSqft = rawPrice / areaPerSlab
    pricePerSqft =
      convertedPerSqft >= 5 && convertedPerSqft <= 250 ? convertedPerSqft : rawPrice
  }

  if (pricePerSqft <= 0 || pricePerSqft > 250) return null

  return { pricePerSqft, lengthInches, widthInches }
}

export function stripSpecialOrderMarker(text: string): string {
  return text.replace(SPECIAL_ORDER_MARKER_RE, '').trim()
}

export function parseSlabsAndDelivery(text: string): {
  slabs?: number
  deliveryCost?: number
} {
  const lower = text.toLowerCase()
  let slabs: number | undefined
  let deliveryCost: number | undefined

  const slabsMatch = lower.match(/(\d+(?:\.\d+)?)\s*slabs?/)
  if (slabsMatch) {
    slabs = Number.parseFloat(slabsMatch[1])
  }

  const deliveryPatterns = [
    /(?:delivery|deliver(?:y)?(?:\s+cost)?)[:\s]*\$?\s*(\d+(?:\.\d+)?)/i,
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:for\s+)?delivery/i,
    /delivery\s+\$?\s*(\d+(?:\.\d+)?)/i,
  ]

  for (const pattern of deliveryPatterns) {
    const match = text.match(pattern)
    if (match) {
      deliveryCost = Number.parseFloat(match[1])
      break
    }
  }

  if (slabs === undefined) {
    const bareNumber = lower.match(/\b(\d+)\b/)
    if (bareNumber && !deliveryCost) {
      slabs = Number.parseFloat(bareNumber[1])
    }
  }

  if (
    slabs !== undefined &&
    (!Number.isFinite(slabs) || slabs <= 0 || !Number.isInteger(slabs))
  ) {
    slabs = undefined
  }

  if (
    deliveryCost !== undefined &&
    (!Number.isFinite(deliveryCost) || deliveryCost < 0)
  ) {
    deliveryCost = undefined
  }

  return { slabs, deliveryCost }
}

export function userDeclinedSpecialOrder(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return (
    lower === 'no' ||
    lower === 'n' ||
    lower === 'no thanks' ||
    lower === 'nope' ||
    lower.startsWith('no,') ||
    lower.startsWith('no ') ||
    lower.includes("don't") ||
    lower.includes('do not')
  )
}

export function userAcceptedSpecialOrder(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return (
    lower === 'yes' ||
    lower === 'y' ||
    lower === 'yeah' ||
    lower === 'sure' ||
    lower === 'ok' ||
    lower === 'okay' ||
    lower.startsWith('yes,') ||
    lower.startsWith('yes ') ||
    lower.includes('adjust') ||
    lower.includes('special order')
  )
}

export const SPECIAL_ORDER_QUESTION =
  '\n\nWould you like me to adjust this price for a special order?'

export function stripAiSpecialOrderPrompt(text: string): string {
  return text
    .replace(
      /\n*\s*Would you like me to adjust this price for a special order\??/gi,
      '',
    )
    .replace(/\n*\s*How many slabs do you need.*?delivery cost\??/gi, '')
    .replace(
      /\n*\s*If yes, please provide a delivery cost and the amount of slabs\.?/gi,
      '',
    )
    .replace(
      /\*\*If yes, please provide a delivery cost and the amount of slabs\.\*\*/gi,
      '',
    )
    .trimEnd()
}

export function appendSpecialOrderPrompt(answer: string): string {
  const withoutPrompt = stripAiSpecialOrderPrompt(answer)
  return `${withoutPrompt.trimEnd()}${SPECIAL_ORDER_QUESTION}`
}

export interface ChatHistoryMessage {
  role: string
  content: string
}

export function hasExistingPriceListContext(messages: ChatHistoryMessage[]): boolean {
  return messages.some(
    message =>
      message.role === 'system' && message.content.startsWith('SUPPLIER PRICE LISTS'),
  )
}

export function looksLikeNewPriceQuery(query: string): boolean {
  const lower = query.toLowerCase().trim()
  return (
    lower.includes('price for') ||
    lower.includes('price of') ||
    lower.includes('cost for') ||
    lower.includes('cost of') ||
    lower.includes('how much') ||
    lower.includes('how wuch') ||
    lower.includes('what is the price') ||
    lower.includes("what's the price") ||
    lower.includes('what is price') ||
    lower.includes("what's price")
  )
}

export function isPriceRelatedQuery(query: string): boolean {
  if (looksLikeNewPriceQuery(query)) return true
  if (isPriceListFollowUp(query)) return true
  const lower = query.toLowerCase().trim()
  return (
    lower.includes('price per') ||
    lower.includes('per sqft') ||
    lower.includes('per square') ||
    lower.includes('square foot') ||
    lower.includes('square feet') ||
    lower.includes('sq ft') ||
    lower.includes('sqft') ||
    lower.includes('price list') ||
    lower.includes('supplier price') ||
    (lower.includes('price') && lower.includes('slab'))
  )
}

export function isPriceListFollowUp(query: string): boolean {
  if (userDeclinedSpecialOrder(query) || userAcceptedSpecialOrder(query)) {
    return true
  }
  const { slabs, deliveryCost } = parseSlabsAndDelivery(query)
  if (slabs !== undefined || deliveryCost !== undefined) {
    return true
  }
  const lower = query.toLowerCase().trim()
  return (
    lower.includes('special order') ||
    lower.includes('delivery') ||
    lower.includes('slab')
  )
}

export function shouldRebuildPriceListContext(
  query: string,
  specialOrderOffer: SpecialOrderOffer | null,
): boolean {
  if (specialOrderOffer) return false
  if (isPriceListFollowUp(query)) return false
  return true
}
