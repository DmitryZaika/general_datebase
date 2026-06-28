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

const HTML_ANCHOR_REGEX =
  /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi

function expandHtmlLinks(html: string): string {
  return html.replace(HTML_ANCHOR_REGEX, (_match, href1, href2, href3, innerHtml) => {
    const href = String(href1 || href2 || href3 || '').trim()
    const label = stripHtmlTags(String(innerHtml)).replace(/\s+/g, ' ').trim()
    if (!href) return label
    if (!label || label === href) return href
    return `${label} (${href})`
  })
}

export function htmlToPlainText(html: string): string {
  const text = stripHtmlTags(
    expandHtmlLinks(html)
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
