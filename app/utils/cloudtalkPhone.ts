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

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function buildCloudTalkCallHref(
  phone: string,
  options?: { mobileLayout?: boolean },
) {
  const cleanPhone = phoneDigits(phone)
  if (!cleanPhone) return ''

  if (typeof navigator === 'undefined') {
    return `tel:${cleanPhone}`
  }

  if (isAndroidDevice() || (options?.mobileLayout && !isIosDevice())) {
    return `intent://call?number=${cleanPhone}#Intent;scheme=cloudtalk;package=${CLOUDTALK_GO_PACKAGE};end;`
  }

  if (isIosDevice() || options?.mobileLayout) {
    return `cloudtalk://call?number=${cleanPhone}`
  }

  return `tel:${cleanPhone}`
}
