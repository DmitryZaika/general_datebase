export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function normalizeToE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return `+${phoneDigitsOnly(trimmed)}`
  const digits = phoneDigitsOnly(trimmed)
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
