export const VOICEMAIL_HEADING_LINE = '- Voicemail'

export const VOICEMAIL_NO_ANSWER_NOTE = `${VOICEMAIL_HEADING_LINE}\n- Action: No answer`

export const VOICEMAIL_GREETING_ACTIVITY_NAME = 'No response, follow-up'

const VOICEMAIL_GREETING_PATTERN =
  /\b(?:please\s+leave(?:\s+(?:your|a))?\s+message|leave\s+(?:us\s+)?(?:your\s+)?(?:a\s+)?message|after\s+the\s+(?:tone|beep)|at\s+the\s+(?:tone|beep)|voice\s*mail(?:\s*box)?|mailbox\s+is\s+full|unable\s+to\s+take\s+your\s+call|can't\s+take\s+your\s+call|not\s+available(?:\s+to\s+take\s+your\s+call)?|record\s+your\s+message)\b/i

export function detectVoicemailFromTranscript(transcript: string): boolean {
  const text = transcript.trim()
  if (!text) return false
  return VOICEMAIL_GREETING_PATTERN.test(text)
}

export function resolveIsVoicemail(flag: boolean, transcript: string): boolean {
  return flag || detectVoicemailFromTranscript(transcript)
}

const REP_OR_JOB_CONTENT_PATTERN =
  /\b(?:(?:this|hey)\s+is\s+\w+\s+with\b|grand\s*diva|grandeeper|countertop|counter\s+top|granite|quartz|marble|quote|estimate|pricing|interested|follow(?:ing)?\s+up|your\s+request|months?\s+ago|ready\s+in|send\s+(?:you|the|us)|kitchen|project|stone|fabricat|call(?:ing)?\s+back|still\s+interested|left\s+(?:you\s+)?(?:a\s+)?message|checking\s+in|touching\s+base)\b/i

const RAW_TRANSCRIPT_LINE_PATTERN =
  /\b(?:please\s+leave(?:\s+(?:your|a))?\s+message|this\s+is\s+\w+\s+with\b|get\s+back\s+to\s+you|thank\s+you\.?$|just\s+let\s+me\s+know)\b/i

const GREETING_ONLY_MAX_WORDS = 45

export function isVoicemailGreetingOnly(transcript: string): boolean {
  const text = transcript.trim()
  if (!text || !detectVoicemailFromTranscript(text)) return false
  if (REP_OR_JOB_CONTENT_PATTERN.test(text)) return false
  return countWords(text) <= GREETING_ONLY_MAX_WORDS
}

const LEGACY_VOICEMAIL_HEADING_PATTERN =
  /^\s*-?\s*Call type:\s*Voicemail(?:\.\s*No answer)?\s*$/i

const VOICEMAIL_HEADING_LINE_PATTERN = /^\s*-?\s*Voicemail\s*$/i

export function noteHasVoicemailHeading(content: string): boolean {
  return content.split('\n').some(line => {
    const trimmed = line.trim()
    return (
      VOICEMAIL_HEADING_LINE_PATTERN.test(trimmed) ||
      LEGACY_VOICEMAIL_HEADING_PATTERN.test(trimmed)
    )
  })
}

function replaceLegacyVoicemailHeadingLines(note: string): string {
  return note
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (LEGACY_VOICEMAIL_HEADING_PATTERN.test(trimmed)) {
        return VOICEMAIL_HEADING_LINE
      }
      return line
    })
    .join('\n')
}

function stripVoicemailHeadingLines(note: string): string {
  return note
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      if (VOICEMAIL_HEADING_LINE_PATTERN.test(trimmed)) return false
      if (LEGACY_VOICEMAIL_HEADING_PATTERN.test(trimmed)) return false
      return true
    })
    .join('\n')
    .trim()
}

function stripNoteLines(content: string, linePattern: RegExp): string {
  return content
    .split('\n')
    .filter(line => !linePattern.test(line.trim()))
    .join('\n')
    .trim()
}

export function withVoicemailCallType(content: string, isVoicemail: boolean): string {
  if (!isVoicemail) return content
  const body = stripVoicemailHeadingLines(
    replaceLegacyVoicemailHeadingLines(content.trim()),
  )
  if (!body) return VOICEMAIL_HEADING_LINE
  return `${VOICEMAIL_HEADING_LINE}\n${body}`
}

const CONTACTED_BULLET_PATTERN = /^\s*-\s*Contacted\b[^:]*:\s*/i

function normalizeVoicemailNoteLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return trimmed
  if (CONTACTED_BULLET_PATTERN.test(trimmed)) {
    return trimmed.replace(CONTACTED_BULLET_PATTERN, '- Action: ')
  }
  if (/^\s*-\s*Goal of the call:\s*/i.test(trimmed)) {
    return trimmed.replace(/^\s*-\s*Goal of the call:\s*/i, '- Action: ')
  }
  return trimmed
}

const BULLET_PARTS_PATTERN = /^\s*-\s*([^:]+):\s*(.*)$/

function isVoicemailBulletLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (VOICEMAIL_HEADING_LINE_PATTERN.test(trimmed)) return true
  if (LEGACY_VOICEMAIL_HEADING_PATTERN.test(trimmed)) return true
  return BULLET_PARTS_PATTERN.test(trimmed)
}

function stripUnstructuredVoicemailLines(note: string): string {
  return note
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      if (!trimmed) return false
      if (isVoicemailBulletLine(trimmed)) return true
      if (RAW_TRANSCRIPT_LINE_PATTERN.test(trimmed)) return false
      if (trimmed.length > 72 && !trimmed.startsWith('-')) return false
      return trimmed.startsWith('-')
    })
    .join('\n')
    .trim()
}

function compactPriorTimingPhrase(value: string): string {
  const text = value.trim().replace(/^previously:\s*/i, '')
  const mayTiming = text.match(/\bmay\b/i)
  if (mayTiming && /mention|potential|timing|ready|project/i.test(text)) {
    return 'prior note: May'
  }
  if (text.length > 35) {
    return `prior: ${text.slice(0, 32).trim()}…`
  }
  return text.startsWith('prior') ? text : `prior: ${text}`
}

function combineVoicemailBullets(lines: string[]): string[] {
  let action: string | null = null
  let priorTiming: string | null = null
  let nextSteps: string | null = null

  for (const line of lines) {
    const match = line.trim().match(BULLET_PARTS_PATTERN)
    if (!match) {
      continue
    }
    const label = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (label === 'call type' || label === 'voicemail') continue
    if (label === 'action') action = value
    else if (label === 'previously' || label.startsWith('previously')) {
      priorTiming = value
    } else if (label === 'project timing') {
      priorTiming = value
    } else if (label === 'next steps discussed') {
      nextSteps = value
    }
  }

  const merged: string[] = []
  if (action || priorTiming) {
    let actionText = action ?? ''
    if (priorTiming && !/\bprior\b/i.test(actionText)) {
      const prior = compactPriorTimingPhrase(priorTiming)
      actionText = actionText ? `${actionText}; ${prior}` : prior
    }
    merged.push(`- Action: ${actionText}`)
  }
  if (nextSteps) {
    let step = nextSteps.replace(/\s+in proceeding\.?$/i, '').trim()
    step = step.replace(/^confirm if still interested/i, 'confirm still interested')
    merged.push(`- Next steps discussed: ${step}`)
  }

  return merged
}

export function normalizeVoicemailNote(note: string): string {
  const lines = note
    .split('\n')
    .map(normalizeVoicemailNoteLine)
    .filter(line => line.length > 0)

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const line of lines) {
    const key = line.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(line)
  }

  return combineVoicemailBullets(deduped).join('\n')
}

export function sanitizeCallNoteContent(
  content: string,
  isVoicemail: boolean,
  transcript?: string,
): string {
  if (isVoicemail && transcript && isVoicemailGreetingOnly(transcript)) {
    return VOICEMAIL_NO_ANSWER_NOTE
  }

  let note = stripNoteLines(content.trim(), /^\s*-?\s*Customer\s*:/i)
  note = stripNoteLines(note, /^\s*-?\s*Next steps discussed\s*:/i)
  if (!isVoicemail) {
    note = stripNoteLines(note, /^\s*-?\s*Call type\s*:/i)
    return note
  }
  note = stripUnstructuredVoicemailLines(note)
  note = normalizeVoicemailNote(note)
  return withVoicemailCallType(note, true)
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
