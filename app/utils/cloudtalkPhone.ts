export function phoneDigits(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

export function normalizeCloudTalkAgentId(agentId: string | number | null | undefined) {
  const trimmed = String(agentId ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export function hasCloudTalkAgentId(agentId: string | number | null | undefined) {
  return normalizeCloudTalkAgentId(agentId) !== null
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function formatTelNumber(phone: string) {
  const digits = phoneDigits(phone)
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export function buildTelHref(phone: string) {
  const telNumber = formatTelNumber(phone)
  if (!telNumber) return ''
  return `tel:${telNumber}`
}

export function shouldShowPhoneCallLink(options: {
  isMobileLayout: boolean
  cloudtalkAgentId: string | null
}) {
  return (
    options.isMobileLayout ||
    isMobileDevice() ||
    hasCloudTalkAgentId(options.cloudtalkAgentId)
  )
}
