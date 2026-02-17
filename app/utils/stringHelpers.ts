export function parseEmailAddress(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  const s = raw.trim()
  const match = s.match(/<([^>]+)>/)
  return match ? match[1].trim() : s
}

export const stripHtmlTags = (html: string): string => html.replace(/<[^>]*>/g, '')

export const isEmptyRichText = (html: string): boolean => {
  if (!html?.trim()) return true
  if (html === '<p><br></p>') return true
  return stripHtmlTags(html).trim() === ''
}
