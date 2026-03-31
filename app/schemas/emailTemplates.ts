import { z } from 'zod'
import {
  getUnfilledCustomVariables,
  validateTemplateBody,
} from '~/utils/emailTemplateVariables'

export interface LeadGroup {
  id: number
  name: string
}

export const emailTemplateSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
  template_subject: z.string().min(1, 'Template subject is required'),
  template_body: z
    .string()
    .min(1, 'Template body is required')
    .refine(
      (val: string) => {
        const text = val.replace(/<[^>]*>/g, '')
        return validateTemplateBody(text).isValid
      },
      {
        message: 'Invalid template body format. Check for unclosed {{ or }}.',
      },
    ),
  lead_group_id: z.union([z.string(), z.number().transform(String)]),
  hour_delay: z.union([z.string(), z.number().transform(String)]),
  show_template: z.union([z.boolean(), z.string().transform(val => val === 'true')]),
})

/** Form data type — uses boolean for show_template (Switch component). */
export interface EmailTemplateFormData {
  template_name: string
  template_subject: string
  template_body: string
  lead_group_id: string
  hour_delay: string
  show_template: boolean
}

/**
 * Parse auto-send fields from validated form data.
 * Returns null values when fields are empty (not configured).
 */
export function parseAutoSendFields(data: EmailTemplateFormData) {
  const leadGroupId = data.lead_group_id ? parseInt(data.lead_group_id, 10) : null
  const hourDelay = data.hour_delay ? parseInt(data.hour_delay, 10) : null

  return {
    leadGroupId:
      leadGroupId !== null && !Number.isNaN(leadGroupId) ? leadGroupId : null,
    hourDelay: hourDelay !== null && !Number.isNaN(hourDelay) ? hourDelay : null,
    showTemplate: data.show_template,
  }
}

/**
 * Validate auto-send fields: both must be set together, hour_delay > 0,
 * and no custom template variables allowed.
 * Returns an errors object for remix-hook-form if invalid, or null if valid.
 */
export function validateAutoSendFields(data: EmailTemplateFormData) {
  const hasGroup = Boolean(data.lead_group_id)
  const hasDelay = Boolean(data.hour_delay)

  if (!hasGroup && !hasDelay) return null

  if (hasGroup && !hasDelay) {
    return {
      errors: {
        hour_delay: { message: 'Delay is required when Lead Group is set' },
      },
    }
  }

  if (!hasGroup && hasDelay) {
    return {
      errors: {
        lead_group_id: { message: 'Lead Group is required when Delay is set' },
      },
    }
  }

  const hourDelay = Number(data.hour_delay)
  if (hourDelay <= 0 || Number.isNaN(hourDelay)) {
    return {
      errors: {
        hour_delay: { message: 'Delay must be greater than 0' },
      },
    }
  }

  const bodyText = data.template_body.replace(/<[^>]*>/g, '')
  const bodyCustomVars = getUnfilledCustomVariables(bodyText)
  const subjectCustomVars = getUnfilledCustomVariables(data.template_subject)
  const allCustomVars = [...new Set([...bodyCustomVars, ...subjectCustomVars])]

  if (allCustomVars.length > 0) {
    return {
      errors: {
        template_body: {
          message: `Auto-send templates cannot use custom variables: ${allCustomVars.map(v => `{{${v}}}`).join(', ')}. Only system variables are allowed.`,
        },
      },
    }
  }

  return null
}

/**
 * Check if a DB error is a duplicate group constraint violation.
 */
export function isDuplicateGroupError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('uk_email_templates_group')
}

export const DUPLICATE_GROUP_ERROR = {
  errors: {
    lead_group_id: {
      message:
        'An auto-send template already exists for this group. Each group can only have one.',
    },
  },
}
