export const stripHtmlTags = (html: string): string => html.replace(/<[^>]*>/g, '')

export const isEmptyRichText = (html: string): boolean => {
  if (!html?.trim()) return true
  if (html === '<p><br></p>') return true
  return stripHtmlTags(html).trim() === ''
}
