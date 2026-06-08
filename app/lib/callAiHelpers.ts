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

const UNKNOWN_BULLET_VALUE_PHRASE_PATTERN =
  /\b(?:not\s+(?:specified|discussed|mentioned)|no\s+specific\b|nothing\s+(?:specific\s+)?(?:mentioned|discussed|stated)|no\s+preference(?:\s+stated)?)\b/i

function isUnknownOrEmptyBulletValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (UNKNOWN_BULLET_VALUE_PATTERN.test(trimmed)) return true
  return UNKNOWN_BULLET_VALUE_PHRASE_PATTERN.test(trimmed)
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

const BUDGET_CONTEXT_PATTERN =
  /\b(?:below|under|around|about|right about|stay(?:ing)?(?:\s+below|\s+under)?|target(?:ing)?|budget(?:\s+of)?|try to stay under)\s*\$?\s*([\d,]+(?:\.\d{2})?)\b/i

const BUDGET_DOLLAR_PATTERN = /\$\s*([\d,]+(?:\.\d{2})?)\b/g

function formatBudgetAmount(raw: string): string {
  const digits = raw.replace(/,/g, '')
  const value = Number.parseFloat(digits)
  if (!Number.isFinite(value)) return `$${raw}`
  if (Number.isInteger(value)) {
    return `$${value.toLocaleString('en-US')}`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function budgetAmountIsPlausible(raw: string): boolean {
  const value = Number.parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(value) && value >= 500 && value <= 500_000
}

export function extractBudgetFromTranscript(transcript: string): string | null {
  const contextMatch = transcript.match(BUDGET_CONTEXT_PATTERN)
  if (contextMatch?.[1] && budgetAmountIsPlausible(contextMatch[1])) {
    return formatBudgetAmount(contextMatch[1])
  }

  const dollarMatches = [...transcript.matchAll(BUDGET_DOLLAR_PATTERN)]
  for (const match of dollarMatches) {
    const raw = match[1]
    if (!budgetAmountIsPlausible(raw)) continue
    const idx = match.index ?? 0
    const context = transcript
      .slice(Math.max(0, idx - 90), idx + match[0].length + 40)
      .toLowerCase()
    if (
      /\b(?:budget|target|below|under|about|around|stay|league|installation|quartz|granite|estimate|quote|trying to)\b/.test(
        context,
      )
    ) {
      return formatBudgetAmount(raw)
    }
  }

  return null
}

function addressCandidateScore(address: string): number {
  const parts = address
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  let score = parts.length * 10
  if (/\b\d{1,6}\s+\w/.test(parts[0] ?? '')) score += 5
  if (parts.length >= 3) score += 10
  return score
}

function appendStreetDirectionFromTranscript(
  street: string,
  transcript: string,
): string {
  const numberMatch = street.match(/^\d{1,6}/)
  if (!numberMatch) return street
  const directionMatch = transcript.match(
    new RegExp(
      `\\b${numberMatch[0]}\\s+[\\w\\s'-]+Court\\s+(East|West|North|South)\\b`,
      'i',
    ),
  )
  const direction = directionMatch?.[1]
  if (!direction) return street
  if (new RegExp(`\\b${direction}\\b`, 'i').test(street)) return street
  return `${street} ${direction}`
}

function buildStreetAddressCandidate(
  street: string,
  direction: string | undefined,
  city: string,
  state: string | undefined,
): string | null {
  let normalizedStreet = street.trim().replace(/\s+/g, ' ')
  const normalizedCity = city.trim().replace(/\s+/g, ' ')
  if (!normalizedStreet || !normalizedCity) return null
  const normalizedDirection = direction ? ` ${direction.trim()}` : ''
  normalizedStreet = `${normalizedStreet}${normalizedDirection}`
  if (state?.trim()) {
    return `${normalizedStreet}, ${normalizedCity}, ${state.trim().replace(/\s+/g, ' ')}`
  }
  return `${normalizedStreet}, ${normalizedCity}`
}

export function extractFullAddressFromTranscript(transcript: string): string | null {
  const candidates: string[] = []

  const fullAddressPattern =
    /\b(\d{1,6}\s+(?:[A-Za-z][\w\s'-]*\s+){0,4}Court(?:\s+(?:East|West|North|South))?)\s*,?\s*([A-Za-z][\w\s'-]*?)(?:,\s*([A-Za-z][\w\s'-]{2,20}))?\b/gi
  for (const match of transcript.matchAll(fullAddressPattern)) {
    const candidate = buildStreetAddressCandidate(
      match[1],
      undefined,
      match[2],
      match[3],
    )
    if (candidate) candidates.push(candidate)
  }

  const courtForCityPattern =
    /\b(\d{1,6})\s+[\w\s,-]{2,60}?\s+Court\s+for\s+([A-Za-z][\w\s'-]*?),\s*([A-Za-z][\w\s'-]{2,20})\b/gi
  for (const match of transcript.matchAll(courtForCityPattern)) {
    const number = match[1].trim()
    const streetMatch = transcript.match(
      new RegExp(
        `${number}\\s+([A-Za-z][\\w\\s'-]+?)\\s*,?\\s*(?:[A-Z]-){0,20}\\s*Court`,
        'i',
      ),
    )
    const streetName = streetMatch?.[1]?.replace(/[,\s-]+/g, ' ').trim() ?? ''
    let street = streetName ? `${number} ${streetName} Court` : `${number} Court`
    street = appendStreetDirectionFromTranscript(street, transcript)
    const candidate = buildStreetAddressCandidate(street, undefined, match[2], match[3])
    if (candidate) candidates.push(candidate)
  }

  if (candidates.length === 0) return null

  return candidates.sort(
    (a, b) => addressCandidateScore(b) - addressCandidateScore(a),
  )[0]
}

function locationValueScore(value: string): number {
  const parts = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  let score = parts.length * 10
  if (/\b\d{1,6}\s+\w/.test(parts[0] ?? '')) score += 5
  if (parts.length >= 3) score += 10
  if (/\bcourt\s+(?:east|west|north|south)\b/i.test(parts[0] ?? '')) score += 5
  if (/court,\s*(?:east|west|north|south)\b/i.test(value)) score -= 8
  return score
}

function consolidateLocationBullets(note: string, transcript: string): string {
  const lines = note.split('\n')
  const locationValues: string[] = []
  let firstLocationIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(BULLET_PARTS_PATTERN)
    if (match?.[1].trim().toLowerCase() === 'location') {
      locationValues.push(match[2].trim())
      if (firstLocationIndex < 0) firstLocationIndex = i
    }
  }

  const extracted = extractFullAddressFromTranscript(transcript)
  const candidates = extracted ? [...locationValues, extracted] : [...locationValues]

  if (candidates.length === 0) return note

  const best = candidates.sort(
    (a, b) => locationValueScore(b) - locationValueScore(a),
  )[0]
  if (!best) return note

  if (locationValues.length === 1 && locationValues[0] === best) return note

  const withoutLocations = lines.filter(line => {
    const match = line.trim().match(BULLET_PARTS_PATTERN)
    return match?.[1].trim().toLowerCase() !== 'location'
  })

  let insertAt = withoutLocations.length
  if (firstLocationIndex >= 0) {
    insertAt = 0
    for (let i = 0; i < firstLocationIndex; i++) {
      const match = lines[i].trim().match(BULLET_PARTS_PATTERN)
      if (match?.[1].trim().toLowerCase() !== 'location') insertAt++
    }
  }

  withoutLocations.splice(insertAt, 0, `- Location: ${best}`)
  return withoutLocations.join('\n')
}

function transcriptConfirmsGraniteTearOut(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    /\bgranite\b/.test(lower) &&
    /\b(?:countertop|counter top|backsplash|remove|tear|demolish|replace)\b/.test(lower)
  )
}

function enhanceTearOutMaterial(note: string, transcript: string): string {
  if (!transcriptConfirmsGraniteTearOut(transcript)) return note

  return note
    .split('\n')
    .map(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return line
      if (match[1].trim().toLowerCase() !== 'tear-out') return line
      let value = match[2].trim()
      if (/\bgranite\b/i.test(value)) return line
      if (/\bexisting countertops\b/i.test(value)) {
        value = value.replace(
          /\bexisting countertops\b/i,
          'existing granite countertops',
        )
      } else if (/\bcountertops\b/i.test(value)) {
        value = value.replace(/\bcountertops\b/i, 'granite countertops')
      } else if (/\bremoves existing\b/i.test(value)) {
        value = value.replace(
          /\bremoves existing\b/i,
          'removes existing granite countertops',
        )
      } else {
        value = `granite tear-out, ${value}`
      }
      return `- Tear-out: ${value}`
    })
    .join('\n')
}

function noteHasBudgetBullet(note: string): boolean {
  return note.split('\n').some(line => {
    const match = line.trim().match(BULLET_PARTS_PATTERN)
    return match?.[1].trim().toLowerCase() === 'budget'
  })
}

function injectBudgetBullet(note: string, transcript: string): string {
  if (noteHasBudgetBullet(note)) return note
  const budget = extractBudgetFromTranscript(transcript)
  if (!budget) return note
  return `${note}\n- Budget: ${budget} for quartz and installation`.trim()
}

function stripSinkNegations(note: string): string {
  return note
    .split('\n')
    .map(line => {
      const match = line.trim().match(BULLET_PARTS_PATTERN)
      if (!match) return line
      const label = match[1].trim().toLowerCase()
      if (label !== 'sink') return line
      let value = match[2].trim()
      value = value
        .replace(/\s*\(\s*not\s+(?:in\s+)?(?:the\s+)?island\s*\)/gi, '')
        .replace(/\s*,?\s*not\s+(?:in\s+)?(?:the\s+)?island\b/gi, '')
        .replace(
          /\s*,?\s*located\s+in\s+(?:the\s+)?l-?shaped\s+section\s*\(\s*not\s+island\s*\)/gi,
          ', in L-shaped section',
        )
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+,/g, ',')
        .trim()
      return `- Sink: ${value}`
    })
    .join('\n')
}

function estimateBulletIsLeadTime(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    /\b\d+\s*(?:to|-)\s*\d+\s*weeks?\b/.test(lower) ||
    /\blead\s*time\b/.test(lower) ||
    /\bwaiting\s+(?:on|for)\b/.test(lower)
  )
}

function estimateBulletIsUnscheduledOnSiteRequest(value: string): boolean {
  const lower = value.toLowerCase()
  if (
    /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    )
  ) {
    return false
  }
  return (
    /\b(?:would\s+appreciate|wants?|request(?:ed|ing)?|like)\b/.test(lower) &&
    /\b(?:on[- ]?site|come\s+over|someone\s+coming)\b/.test(lower)
  )
}

function transcriptShowsRepAskedCustomerToCall(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    /\bgive\s+me\s+a\s+call\b/.test(lower) ||
    /\b(?:you\s+)?call\s+(?:me\s+)?in\s+advance\b/.test(lower) ||
    (/\bcall\b/.test(lower) &&
      /\b(?:advance|a\s+week\s+before|week\s+before)\b/.test(lower))
  )
}

function estimateBulletIsRepProcessOrSchedulingAdvice(value: string): boolean {
  const lower = value.toLowerCase()
  const hasScheduledTime =
    /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    )
  if (estimateBulletIsOnSiteScheduling(lower) && hasScheduledTime) return false
  return (
    /\b(?:salesperson|sales\s+rep|rep)\s+will\s+call\b/.test(lower) ||
    /\bcustomer\s+advised\b/.test(lower) ||
    /\badvised\s+to\s+call\b/.test(lower) ||
    /\bcall\s+(?:in\s+)?advance\b/.test(lower) ||
    /\b(?:one|a)\s+week\s+before\b/.test(lower) ||
    /\bschedule\s+(?:your\s+)?template\b/.test(lower) ||
    /\btemplate\s+(?:on\s+)?(?:the\s+)?next\s+day\b/.test(lower) ||
    /\bmeasurement\s+person\b/.test(lower) ||
    /\binstall(?:ed)?\s+in\s+(?:two|three|2|3)\s+weeks?\b/.test(lower) ||
    /\bsave\s+you\s+another\s+week\b/.test(lower) ||
    (/\b(?:schedule|template|measurement|appointment)\b/.test(lower) &&
      !hasScheduledTime)
  )
}

function extractCustomerTimelineFromEstimate(value: string): string | null {
  const parts: string[] = []
  const lower = value.toLowerCase()
  if (/\b(?:cabinets?|cabinetry)\b/.test(lower) && /\bnext\s+month\b/.test(lower)) {
    parts.push('cabinets expected done next month')
  }
  if (/\bon\s+hold\b/.test(lower)) {
    parts.push('project was on hold, now resuming')
  }
  if (/\bexpired\s+quote\b/.test(lower) || /\bquote\s+expired\b/.test(lower)) {
    parts.push('needs updated quote')
  }
  if (parts.length === 0) return null
  return parts.join('; ')
}

function appendProjectTimingValue(current: string | null, value: string): string {
  if (!current) return value
  if (current.toLowerCase().includes(value.toLowerCase())) return current
  return `${current}; ${value}`
}

function normalizeMisplacedEstimateBullets(note: string, transcript?: string): string {
  let projectTiming: string | null = null
  const lines = note.split('\n').filter(line => {
    const match = line.trim().match(BULLET_PARTS_PATTERN)
    if (!match) return true
    const label = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (label !== 'estimate') return true

    const customerTimeline = extractCustomerTimelineFromEstimate(value)
    if (customerTimeline) {
      projectTiming = appendProjectTimingValue(projectTiming, customerTimeline)
    }

    if (estimateBulletIsLeadTime(value)) {
      projectTiming = appendProjectTimingValue(projectTiming, value)
      return false
    }
    if (estimateBulletIsUnscheduledOnSiteRequest(value)) return false
    if (estimateBulletIsRepProcessOrSchedulingAdvice(value)) return false

    if (
      transcript &&
      transcriptShowsRepAskedCustomerToCall(transcript) &&
      /\b(?:salesperson|sales\s+rep|rep)\s+will\s+call\b/i.test(value)
    ) {
      return false
    }

    if (customerTimeline && !estimateBulletIsOnSiteScheduling(value.toLowerCase())) {
      return false
    }

    return true
  })

  if (!projectTiming) return lines.join('\n')

  const hasProjectTiming = lines.some(line => {
    const match = line.trim().match(BULLET_PARTS_PATTERN)
    return match?.[1].trim().toLowerCase() === 'project timing'
  })

  if (hasProjectTiming) return lines.join('\n')
  return [...lines, `- Project timing: ${projectTiming}`].join('\n')
}

export function customerWillSendMaterialPhoto(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  return (
    /\b(?:i(?:'ll| will)|she|he|we will|can|going to)\s+(?:go ahead and\s+)?send\b[^.]{0,120}\b(?:picture|photo|pic|image)\b/.test(
      lower,
    ) ||
    /\bsend\s+(?:you\s+)?(?:a\s+)?(?:picture|photo|pic|image)\b[^.]{0,120}\b(?:kitchen|layout|color|quartz|tile|countertop)\b/.test(
      lower,
    ) ||
    /\b(?:picture|photo|pic)\b[^.]{0,120}\b(?:kitchen\s+layout|color(?:ing)?|quartz|tile)\b/.test(
      lower,
    )
  )
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
    note = normalizeMisplacedEstimateBullets(note, transcript)
    note = stripSinkNegations(note)
  }
  if (transcript) {
    note = correctRepCallBackAttribution(note, transcript)
    note = correctMissedAppointmentAttribution(note, transcript)
    if (!isVoicemail) {
      note = consolidateLocationBullets(note, transcript)
      note = enhanceTearOutMaterial(note, transcript)
      note = injectBudgetBullet(note, transcript)
    }
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
