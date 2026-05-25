export function phoneDigits(phone: string) {
  return (String(phone || '').match(/[+\d]/g) || []).join('')
}

export function hasCloudTalkAgentId(agentId: string | null | undefined) {
  return String(agentId ?? '').trim() !== ''
}
