export function parseEmailAddress(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  const s = raw.trim()
  const match = s.match(/<([^>]+)>/)
  return match ? match[1].trim() : s
}

export const stripHtmlTags = (html: string): string => html.replace(/<[^>]*>/g, '')

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

const ENTITY_REGEX = /&(?:amp|lt|gt|quot|#39|nbsp|#\d+|#x[\da-fA-F]+);/g

export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY_REGEX, match => {
    if (ENTITY_MAP[match]) return ENTITY_MAP[match]
    if (match.startsWith('&#x'))
      return String.fromCodePoint(Number.parseInt(match.slice(3, -1), 16))
    if (match.startsWith('&#'))
      return String.fromCodePoint(Number.parseInt(match.slice(2, -1), 10))
    return match
  })
}

export function htmlToPlainText(html: string): string {
  const text = stripHtmlTags(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n'),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return decodeHtmlEntities(text)
}

export const isEmptyRichText = (html: string): boolean => {
  if (!html?.trim()) return true
  if (html === '<p><br></p>') return true
  return stripHtmlTags(html).trim() === ''
}
