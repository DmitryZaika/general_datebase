import type { Nullable } from '~/types/utils'

export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function normalizeToE164(phone: Nullable<string> | undefined): Nullable<string> {
  if (!phone) return null
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return `+${phoneDigitsOnly(trimmed)}`
  const digits = phoneDigitsOnly(trimmed)
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function formatPhoneForDisplay(phone: Nullable<string> | undefined): string {
  if (!phone) return ''
  const digits = phoneDigitsOnly(phone)
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function formatPhoneInput(value: string, isDeleting = false): string {
  if (isDeleting) {
    return value.replace(/[^\d-]/g, '').slice(0, 12)
  }
  const truncated = phoneDigitsOnly(value).slice(0, 10)
  if (truncated.length >= 6) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3, 6)}-${truncated.slice(6)}`
  }
  if (truncated.length >= 3) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3)}`
  }
  return truncated
}
