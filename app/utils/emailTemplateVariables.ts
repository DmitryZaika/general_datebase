interface EmailTemplateVariable {
  key: string
  label: string
}

export const EMAIL_TEMPLATE_VARIABLES: EmailTemplateVariable[] = [
  { key: 'user.name', label: 'Full name' },
  { key: 'user.first_name', label: 'First name' },
  { key: 'customer.name', label: 'Customer Full name' },
  { key: 'customer.first_name', label: 'Customer First name' },
  { key: 'current_date', label: 'Current day and month' },
  { key: 'company.name', label: 'Company name' },
  { key: 'company.address', label: 'Company address' },
  { key: 'customer.address', label: 'Customer address' },
  { key: 'user.phone_number', label: 'Employee phone number' },
  { key: 'user.email', label: 'Employee email' },
] as const

export const VARIABLE_KEYS = EMAIL_TEMPLATE_VARIABLES.map(v => v.key)

const HTML_TAG_REGEX = /<[^>]*>/g

function createVariableRegex(): RegExp {
  return /\{\{([^}]+)\}\}/g
}

interface TemplateValidationResult {
  isValid: boolean
  error?: string
}

function stripHtmlTags(html: string): string {
  return html.replace(HTML_TAG_REGEX, '')
}

export function formatVariableForTemplate(key: string): string {
  return `{{${key}}}`
}

export function extractVariablesFromTemplate(template: string): string[] {
  const textOnly = stripHtmlTags(template)
  const regex = createVariableRegex()
  const matches = [...textOnly.matchAll(regex)].map(match => match[1])

  return [...new Set(matches)]
}

export function hasUnfilledVariables(text: string): boolean {
  const regex = createVariableRegex()

  for (const match of text.matchAll(regex)) {
    if (VARIABLE_KEYS.includes(match[1])) {
      return true
    }
  }

  return false
}

export function hasAnyVariables(text: string): boolean {
  const regex = createVariableRegex()
  return regex.test(text)
}

export function getUnfilledCustomVariables(text: string): string[] {
  const regex = createVariableRegex()
  const customVariables: string[] = []

  for (const match of text.matchAll(regex)) {
    if (!VARIABLE_KEYS.includes(match[1])) {
      customVariables.push(match[1])
    }
  }

  return [...new Set(customVariables)]
}

export function validateTemplateBody(text: string): TemplateValidationResult {
  const openBracketCount = (text.match(/\{\{/g) || []).length
  const closeBracketCount = (text.match(/\}\}/g) || []).length

  if (openBracketCount !== closeBracketCount) {
    return {
      isValid: false,
      error: `Mismatched brackets: ${openBracketCount} opening "{{" and ${closeBracketCount} closing "}}"`,
    }
  }

  if (/\{\{\s*\}\}/.test(text)) {
    return {
      isValid: false,
      error: 'Empty variable "{{}}" found',
    }
  }

  const regex = createVariableRegex()
  for (const match of text.matchAll(regex)) {
    const content = match[1]
    if (content.includes('{')) {
      return {
        isValid: false,
        error: 'Nested "{" found inside variable',
      }
    }
  }

  return { isValid: true }
}
