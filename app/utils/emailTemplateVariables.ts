export interface EmailTemplateVariable {
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

export interface TemplateVariableData {
  user?: {
    name?: string
    email?: string
    phone_number?: string
  }
  customer?: {
    name?: string
    address?: string
  }
  company?: {
    name?: string
    address?: string
  }
}

export interface TemplateValidationResult {
  isValid: boolean
  error?: string
}

function stripHtmlTags(html: string): string {
  return html.replace(HTML_TAG_REGEX, '')
}

function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return ''
  return fullName.split(' ')[0] || ''
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

export function formatVariableForTemplate(key: string): string {
  return `{{${key}}}`
}

export function extractVariablesFromTemplate(template: string): string[] {
  const textOnly = stripHtmlTags(template)
  const matches: string[] = []
  const regex = createVariableRegex()
  let match

  while ((match = regex.exec(textOnly)) !== null) {
    matches.push(match[1])
  }

  return [...new Set(matches)]
}

export function hasUnfilledVariables(text: string): boolean {
  const regex = createVariableRegex()
  let match

  while ((match = regex.exec(text)) !== null) {
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
  let match

  while ((match = regex.exec(text)) !== null) {
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
  let match
  while ((match = regex.exec(text)) !== null) {
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

function getVariableValue(
  key: string,
  data: TemplateVariableData,
): string | undefined {
  const valueMap: Record<string, () => string | undefined> = {
    'user.name': () => data.user?.name,
    'user.first_name': () => getFirstName(data.user?.name),
    'user.email': () => data.user?.email,
    'user.phone_number': () => data.user?.phone_number,
    'customer.name': () => data.customer?.name,
    'customer.first_name': () => getFirstName(data.customer?.name),
    'customer.address': () => data.customer?.address,
    'company.name': () => data.company?.name,
    'company.address': () => data.company?.address,
    'current_date': () => formatCurrentDate(),
  }

  const getValue = valueMap[key]
  return getValue ? getValue() : undefined
}

export function replaceTemplateVariables(
  template: string,
  data: TemplateVariableData,
): string {
  return VARIABLE_KEYS.reduce((result, key) => {
    const value = getVariableValue(key, data)
    if (!value) return result

    const placeholder = formatVariableForTemplate(key)
    return result.replaceAll(placeholder, value)
  }, template)
}
