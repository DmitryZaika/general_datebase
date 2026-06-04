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

const UNKNOWN_BULLET_VALUE_PATTERN =
  /^(?:not\s+specified|unknown|n\/a|na|none|not\s+discussed|no\s+details(?:\s+discussed)?|unspecified|—|-|\.)$/i

function isUnknownOrEmptyBulletValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return UNKNOWN_BULLET_VALUE_PATTERN.test(trimmed)
}

function stripUnknownNoteBullets(note: string): string {
  return note
    .split('\n')
    .filter(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return true
      return !isUnknownOrEmptyBulletValue(match[2])
    })
    .join('\n')
    .trim()
}

function transcriptShowsSalespersonMissedAppointment(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    /\b(?:i|we)\s+(?:somehow\s+)?missed\b/.test(lower) ||
    /\bmy\s+mistake\b/.test(lower) ||
    /\bno\s+way\s+i\s+missed\b/.test(lower) ||
    (/\b(?:i'?m|i am)\s+sorry\b/.test(lower) && /\bmissed\b/.test(lower))
  )
}

function estimateBulletIsOnSiteScheduling(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    /\b(?:on[- ]?site|be here|stop by|come out|measurement visit|will be there|see you at)\b/.test(
      lower,
    ) ||
    (/\b(?:appointment|missed|reschedul)\b/.test(lower) &&
      /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|at\s+\d|today|tomorrow)\b/.test(lower))
  )
}

function estimateBulletIsPhoneCallbackScheduling(value: string): boolean {
  const lower = value.toLowerCase()
  if (estimateBulletIsOnSiteScheduling(lower)) return false
  return (
    /\b(?:call\s+me|call\s+back|callback|follow[- ]?up)\b/.test(lower) ||
    /\bcustomer\s+will\s+call\b/.test(lower) ||
    (/\b(?:quote|pricing)\b/.test(lower) &&
      /\b(?:discuss|questions?|follow|check)\b/.test(lower) &&
      /\b(?:friday|monday|tuesday|wednesday|thursday|saturday|sunday|next|weekend)\b/.test(
        lower,
      )) ||
    (/\b(?:home depot|lowe)\b/.test(lower) &&
      /\b(?:quote|compare|shopping|questions?)\b/.test(lower))
  )
}

function transcriptShowsCustomerAskedRepToCall(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    /\b(?:you\s+can\s+call\s+me|call\s+me)\b/.test(lower) ||
    (/\b(?:would you like\s+(?:me\s+)?to\s+)?call\s+you\b/.test(lower) &&
      /\b(?:yes|okay|good|will do|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|friday)\b/.test(
        lower,
      ))
  )
}

function customerWillCallIsRepCallbackMisattribution(value: string): boolean {
  if (/\bwhen\s+ready\b/i.test(value)) return false
  if (/\bcontact(?:s)?\s+(?:the\s+)?(?:company|us)\s+when\b/i.test(value)) {
    return false
  }
  return /\bcustomer\s+will\s+call\b/i.test(value)
}

function normalizeEstimateNoteBullets(note: string): string {
  return note
    .split('\n')
    .filter(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return true
      const label = match[1].trim().toLowerCase()
      const value = match[2].trim()
      if (label !== 'estimate') return true
      return !estimateBulletIsPhoneCallbackScheduling(value)
    })
    .map(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return line
      const label = match[1].trim().toLowerCase()
      const value = match[2].trim()
      if (label === 'site visit') {
        return `- Estimate: ${value}`
      }
      if (label !== 'project timing') return line
      if (estimateBulletIsPhoneCallbackScheduling(value)) return line
      if (
        !/\b(?:appointment|estimate|measurement|missed|reschedul|site\s+visit)\b/i.test(
          value,
        )
      ) {
        return line
      }
      return `- Estimate: ${value}`
    })
    .join('\n')
}

function correctRepCallBackAttribution(note: string, transcript: string): string {
  if (!transcriptShowsCustomerAskedRepToCall(transcript)) return note

  return note
    .split('\n')
    .map(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return line
      const label = match[1].trim()
      let value = match[2].trim()
      if (!customerWillCallIsRepCallbackMisattribution(value)) return line
      value = value.replace(
        /\bcustomer\s+will\s+call\b/gi,
        'salesperson will call customer',
      )
      return `- ${label}: ${value}`
    })
    .join('\n')
}

function correctMissedAppointmentAttribution(note: string, transcript: string): string {
  if (!transcriptShowsSalespersonMissedAppointment(transcript)) return note

  return note
    .split('\n')
    .map(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return line
      const label = match[1].trim()
      let value = match[2].trim()
      if (!/\bmissed\b/i.test(value) && !/\bappointment\b/i.test(value)) {
        return line
      }
      value = value.replace(/\bcustomer\s+missed\b/gi, 'salesperson missed')
      if (
        /\bmissed\b/i.test(value) &&
        !/\b(?:salesperson|sales\s+rep|rep)\s+missed\b/i.test(value) &&
        /\b(?:appointment|10:?\d{2}|estimate|measurement|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i.test(
          value,
        )
      ) {
        value = value.replace(/\bmissed\b/i, 'salesperson missed')
      }
      return `- ${label}: ${value}`
    })
    .join('\n')
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
  note = stripUnknownNoteBullets(note)
  if (!isVoicemail) {
    note = normalizeEstimateNoteBullets(note)
  }
  if (transcript) {
    note = correctRepCallBackAttribution(note, transcript)
    note = correctMissedAppointmentAttribution(note, transcript)
  }
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
