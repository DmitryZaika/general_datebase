export const CLOUDTALK_GO_PACKAGE = 'io.cloudtalk.go'

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

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
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

export function buildAndroidCloudTalkDialIntent(phone: string) {
  const telHref = buildTelHref(phone)
  if (!telHref) return ''

  const encodedTelHref = encodeURIComponent(telHref)
  return `intent:#Intent;action=android.intent.action.DIAL;data=${encodedTelHref};package=${CLOUDTALK_GO_PACKAGE};S.browser_fallback_url=${encodedTelHref};end`
}

export function buildCloudTalkCallHref(phone: string) {
  const telHref = buildTelHref(phone)
  if (!telHref) return ''

  if (typeof navigator !== 'undefined' && isAndroidDevice()) {
    return buildAndroidCloudTalkDialIntent(phone)
  }

  return telHref
}
