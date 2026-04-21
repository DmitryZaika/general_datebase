import { decodeHtmlEntities } from '~/utils/stringHelpers'

export interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
}

export const TEMPLATE_STALE_TIME = 60_000

export const TEMPLATE_PREVIEW_LENGTH = 60

export function templateQueryKey(companyId: number) {
  return ['emailTemplates', companyId] as const
}

export function filterTemplates(
  templates: EmailTemplate[],
  query: string,
): EmailTemplate[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return templates
  return templates.filter(
    t =>
      t.template_name.toLowerCase().includes(normalized) ||
      t.template_body.toLowerCase().includes(normalized),
  )
}

export function getTemplatePreview(body: string, length = TEMPLATE_PREVIEW_LENGTH) {
  const stripped = body.replace(/<[^>]*>/g, '')
  return decodeHtmlEntities(stripped).slice(0, length)
}

export async function fetchAllTemplates(companyId: number) {
  const response = await fetch(`/api/email-templates/search/${companyId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch templates')
  }
  const data = await response.json()
  return data.templates as EmailTemplate[]
}
