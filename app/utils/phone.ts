import type { Nullable } from '~/types/utils'

export const PHONE_DIGITS_REGEX = /^\d{10,15}$/

// SMS body limits, shared by the composer and the server send action.
export const SMS_MAX_TEXT = 1600
export const SMS_SEGMENT_LEN = 160

export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
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

// Returns both 10-digit and 11-digit forms — BIGINT phone columns drop any
// leading "1", so equality checks need to test both.
export function phoneVariants(digits: string): string[] {
  const trimmed = digits.replace(/\D+/g, '')
  if (trimmed.length === 0) return []
  const variants = new Set<string>()
  variants.add(trimmed)
  if (trimmed.length === 11 && trimmed.startsWith('1')) {
    variants.add(trimmed.slice(1))
  }
  if (trimmed.length === 10) {
    variants.add(`1${trimmed}`)
  }
  return [...variants]
}

// Last 10 digits — matches how the Rust webhook stores sender/recipient.
export function canonicalPhone10(phone: string): string {
  const digits = phone.replace(/\D+/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
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
