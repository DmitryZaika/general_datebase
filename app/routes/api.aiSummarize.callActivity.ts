import OpenAI from 'openai'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import {
  countWords,
  isVoicemailGreetingOnly,
  resolveIsVoicemail,
  VOICEMAIL_GREETING_ACTIVITY_NAME,
} from '~/lib/callAiHelpers'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const summarizeSchema = z.object({
  transcript: z.string().min(1),
  callStartedAt: z.string().optional(),
  committedAt: z.string().optional(),
  isVoicemail: z.boolean().optional(),
})

const VOICEMAIL_ACTIVITY_SKIP_AI_WORDS = 50
const VOICEMAIL_DEFAULT_ACTIVITY_NAME = 'Follow-up to confirm interest'

const activityItemSchema = z.object({
  name: z.string().optional(),
  deadline: z.string().nullable().optional(),
})

const activitiesResponseSchema = z.object({
  activities: z.array(activityItemSchema).optional(),
  name: z.string().optional(),
  deadline: z.string().nullable().optional(),
})

const DEFAULT_ACTIVITY_NAME = 'Follow-up'

export interface ExtractedCallActivity {
  name: string
  deadline: string | null
}

const IMMEDIATE_DEADLINE_PATTERN =
  /\b(right away|right now|immediately|asap|send (?:it |you |them |the )?(?:now|shortly)|(?:now|shortly|asap).{0,30}send|a little (?:bit )?later)\b/i
const TOMORROW_DEADLINE_PATTERN = /\btomorrow\b/i
const TODAY_DEADLINE_PATTERN = /\btoday\b/i
const STORE_BUSINESS_TIMEZONE = 'America/Indiana/Indianapolis'
const STORE_CLOSE_HOUR = 18
const DEADLINE_HOURS_BEFORE_STORE_CLOSE = 2
const QUOTE_MINIMUM_LEAD_MINUTES = 60
const ONSITE_ESTIMATE_LEAD_MINUTES = 30
const CONFIRMED_ONSITE_ESTIMATE_NAME = 'Be on-site for estimate'
const EXPLICIT_TIME_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i

function parseIsoDate(value: string | undefined): Date {
  if (value?.trim()) {
    const parsed = new Date(value.trim())
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatUtcIsoDateTime(date: Date): string {
  return date.toISOString()
}

function getZonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '0'
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  }
}

function zonedWallTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  for (let attempt = 0; attempt < 5; attempt++) {
    const actual = getZonedParts(new Date(utcMs), timeZone)
    const diffMinutes =
      (hour - actual.hour) * 60 +
      (minute - actual.minute) +
      (day - actual.day) * 24 * 60 +
      (month - actual.month) * 31 * 24 * 60 +
      (year - actual.year) * 366 * 24 * 60
    if (diffMinutes === 0) break
    utcMs += diffMinutes * 60_000
  }
  return new Date(utcMs).toISOString()
}

function getStoreCalendarDateParts(from: Date): {
  year: number
  month: number
  day: number
} {
  const parts = getZonedParts(from, STORE_BUSINESS_TIMEZONE)
  return { year: parts.year, month: parts.month, day: parts.day }
}

function addStoreCalendarDays(
  from: Date,
  days: number,
): { year: number; month: number; day: number } {
  const { year, month, day } = getStoreCalendarDateParts(from)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

function formatStoreDateOnlyPlusDays(from: Date, days: number): string {
  const { year, month, day } = addStoreCalendarDays(from, days)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function storeCloseDeadlineOnCallDay(committedAt: Date, dayOffset: number): string {
  const { year, month, day } = addStoreCalendarDays(committedAt, dayOffset)
  const dueHour = STORE_CLOSE_HOUR - DEADLINE_HOURS_BEFORE_STORE_CLOSE
  return zonedWallTimeToUtcIso(year, month, day, dueHour, 0, STORE_BUSINESS_TIMEZONE)
}

const REP_TWO_THREE_WEEK_CALLBACK_PATTERN =
  /\b(?:would you like (?:me|us) to )?call(?: you| back)?\b[^.]{0,120}\b(?:in\s+)?(?:about\s+)?(?:(?:two|2)\s*(?:or|to|-)\s*(?:three|3)|(?:one|two|three|four|five|six|\d{1,2}))\s*weeks?\b|\b(?:i(?:'ll| will)|we will)\s+call(?: you| back)?\b[^.]{0,80}\b(?:in\s+)?(?:(?:two|2)\s*(?:or|to|-)\s*(?:three|3)|(?:one|two|three|four|five|six|\d{1,2}))\s*weeks?\b/i

const TWO_THREE_WEEKS_MENTION_PATTERN =
  /\b(?:(?:two|2)\s*(?:or|to|-)\s*(?:three|3)|(?:one|two|three|four|five|six|\d{1,2}))\s*weeks?\b/i

const CALLBACK_ACTIVITY_NAME_PATTERN = /\b(?:call\s+back|follow[- ]?up|callback)\b/i

const REP_TWO_THREE_WEEK_CALLBACK_DAYS = 14

function stripCalendarDatesFromActivityName(name: string): string {
  return name
    .replace(
      /\b(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?\b/gi,
      '',
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^,\s*|\s*,\s*$/g, '')
    .trim()
}

const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function getStoreWeekdayIndex(committedAt: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_BUSINESS_TIMEZONE,
    weekday: 'long',
  })
    .format(committedAt)
    .toLowerCase()
  return WEEKDAY_NAME_TO_INDEX[weekday] ?? 0
}

function daysUntilWeekdayLabel(
  committedAt: Date,
  weekdayName: string,
  useNextWeek: boolean,
): number {
  const target = WEEKDAY_NAME_TO_INDEX[weekdayName.toLowerCase()]
  if (target === undefined) return 0
  const current = getStoreWeekdayIndex(committedAt)
  let diff = target - current
  if (diff <= 0) diff += 7
  if (useNextWeek) diff += 7
  return diff
}

function isCallBackActivity(name: string): boolean {
  return CALLBACK_ACTIVITY_NAME_PATTERN.test(name.toLowerCase())
}

function capitalizeWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function cleanPlaceName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+(before|when|after|and|or|so|we|they|the|from)\s*$/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(capitalizeWord)
    .join(' ')
}

function inferCallBackContextDetail(transcript: string): string | null {
  const lower = transcript.toLowerCase()

  if (/\blitigation\b/.test(lower)) return null
  if (/\bmove forward\b/.test(lower)) return null

  const backFrom = lower.match(
    /\b(?:get|got|come|coming)\s+back\s+from\s+([a-z][a-z\s'-]{1,40}?)(?:\s+before|\s+when|\s+to|\s+and|\.|,|\?|!|$)/,
  )
  const vacationDestination = lower.match(
    /\bvacation(?:\s+on\s+\w+)?\s+to\s+([a-z][a-z\s'-]{1,30}?)(?:\s+|\.|,|$)/,
  )
  const tripTo = lower.match(/\btrip\s+to\s+([a-z][a-z\s'-]{1,30}?)(?:\s+|\.|,|$)/)

  const destinationRaw = vacationDestination?.[1] ?? tripTo?.[1] ?? backFrom?.[1] ?? ''
  const destination = cleanPlaceName(destinationRaw)

  if (/\bvacation\b/.test(lower)) {
    if (destination.length > 1) {
      return `after vacation to ${destination}`
    }
    return 'after vacation'
  }

  if (
    backFrom?.[1] &&
    /\b(?:trip|travel|decision|check back|make a final)\b/.test(lower)
  ) {
    const place = cleanPlaceName(backFrom[1])
    if (place.length > 1) return `after trip to ${place}`
  }

  if (
    /\b(?:holiday|holidays)\b/.test(lower) &&
    /\b(?:get back|when|after|before|decision)\b/.test(lower)
  ) {
    return 'after holiday'
  }

  if (
    /\b(?:make a final decision|final decision|not ready yet)\b/.test(lower) &&
    /\b(?:vacation|trip|travel|get back|few weeks)\b/.test(lower)
  ) {
    return 'after they decide'
  }

  return null
}

function buildCallBackActivityBaseName(transcript: string): string {
  const lower = transcript.toLowerCase()
  if (
    /\bquote\b/.test(lower) &&
    /\b(?:questions?|check|follow\s+up|saw the|sent you|home depot|lowe)/.test(lower)
  ) {
    return 'Call back, follow up on quote'
  }
  if (/\blitigation\b/.test(lower)) {
    return 'Call back, check if litigation is finished'
  }
  if (/\bmove forward\b/.test(lower)) {
    return 'Call back, check if ready to move forward'
  }
  if (/\bconfirm\b/.test(lower) && /\binterest\b/.test(lower)) {
    return 'Call back, confirm still interested'
  }
  if (/\bkitchen\b/.test(lower)) {
    return 'Call back, follow up on kitchen project'
  }
  if (/\b(?:countertop|counter top|counter)\b/.test(lower)) {
    return 'Call back, follow up on countertop project'
  }
  return 'Call back, follow up'
}

function buildCallBackActivityName(transcript: string): string {
  const base = buildCallBackActivityBaseName(transcript)
  const detail = inferCallBackContextDetail(transcript)
  if (!detail) return base
  const detailCore = detail.replace(/^after /, '')
  if (base.toLowerCase().includes(detailCore)) return base
  return `${base} ${detail}`
}

const AGREED_WEEK_COUNT_TOKEN =
  '(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})'

const AGREED_WEEKS_IN_TEXT_PATTERN = new RegExp(
  `\\b(?:about\\s+)?(?:in\\s+)?(${AGREED_WEEK_COUNT_TOKEN})\\s*weeks?\\b`,
  'i',
)

const CALL_BACK_TIMING_CONTEXT_PATTERN =
  /\b(?:would you like (?:me|us) to )?(?:call|follow\s+(?:you\s+)?up)\b|\bfollow\s+(?:you\s+)?up\b|\bcall\s+you\b|\bfollow\s+up\b|\bcall\s+(?:you|me|back)\b|\bwould you like\b/

function parseWeekCount(raw: string): number | null {
  const lower = raw.toLowerCase().trim()
  if (lower === 'a' || lower === 'an') return 1
  const digit = Number.parseInt(lower, 10)
  if (Number.isFinite(digit) && digit >= 1 && digit <= 52) return digit
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }
  return words[lower] ?? null
}

function inferAgreedCallBackWeeksFromTranscript(transcript: string): number | null {
  const lower = transcript.toLowerCase()
  if (!CALL_BACK_TIMING_CONTEXT_PATTERN.test(lower)) {
    return null
  }

  const weekPattern = new RegExp(AGREED_WEEKS_IN_TEXT_PATTERN.source, 'gi')
  const sentences = lower
    .split(/(?<=[.?!])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)

  let callBackContext = false
  let lastWeeks: number | null = null

  for (const sentence of sentences) {
    if (CALL_BACK_TIMING_CONTEXT_PATTERN.test(sentence)) {
      callBackContext = true
    }

    const isAmbiguousRange = /\b(?:two|2)\s*(?:or|to|-)\s*(?:three|3)\s*weeks?\b/.test(
      sentence,
    )
    const customerConfirmed = /\b(?:yeah|yes|yep|sure|ok|good|will do)\b/.test(sentence)

    if (isAmbiguousRange && !customerConfirmed) {
      lastWeeks = null
      continue
    }

    weekPattern.lastIndex = 0
    let match = weekPattern.exec(sentence)
    while (match) {
      if (callBackContext || /\bcall\b/.test(sentence)) {
        const parsed = parseWeekCount(match[1])
        if (parsed !== null) lastWeeks = parsed
      }
      match = weekPattern.exec(sentence)
    }
  }

  return lastWeeks
}

function inferAgreedCallBackDeadlineFromTranscript(
  transcript: string,
  committedAt: Date,
): string | null {
  const lower = transcript.toLowerCase()
  if (!CALL_BACK_TIMING_CONTEXT_PATTERN.test(lower)) return null

  const agreedWeeks = inferAgreedCallBackWeeksFromTranscript(transcript)
  if (agreedWeeks !== null) {
    return formatStoreDateOnlyPlusDays(committedAt, agreedWeeks * 7)
  }

  const customerNext = lower.match(
    /\b(?:you\s+can\s+call\s+me|call\s+me)\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (customerNext?.[1]) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, customerNext[1], true),
    )
  }

  const repNextCheck = lower.match(
    /\b(?:would you like\s+(?:me\s+)?to\s+)?call\s+you\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (repNextCheck?.[1]) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, repNextCheck[1], true),
    )
  }

  if (
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    ) &&
    /\b(?:call|check|quote|questions?|will do|okay|good)\b/.test(lower)
  ) {
    const match = lower.match(
      /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    )
    if (match?.[1]) {
      return formatStoreDateOnlyPlusDays(
        committedAt,
        daysUntilWeekdayLabel(committedAt, match[1], true),
      )
    }
  }

  const plainWeekday = lower.match(
    /\b(?:call\s+(?:you|me)\s+)?(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (
    plainWeekday?.[1] &&
    !/\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    )
  ) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, plainWeekday[1], false),
    )
  }

  return null
}

function applyAgreedCallBackActivity(
  activity: ExtractedCallActivity,
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity {
  if (!isCallBackActivity(activity.name)) return activity
  const deadline = inferAgreedCallBackDeadlineFromTranscript(transcript, committedAt)
  return {
    name: buildCallBackActivityName(transcript),
    deadline: deadline ?? activity.deadline,
  }
}

function buildRepTwoThreeWeekCallBackName(transcript: string): string {
  return buildCallBackActivityName(transcript)
}

function isRepTwoThreeWeekCallBackTask(
  activityName: string,
  transcript: string,
): boolean {
  const transcriptLower = transcript.toLowerCase()
  const nameLower = activityName.toLowerCase()
  if (!REP_TWO_THREE_WEEK_CALLBACK_PATTERN.test(transcriptLower)) return false
  return (
    CALLBACK_ACTIVITY_NAME_PATTERN.test(nameLower) ||
    TWO_THREE_WEEKS_MENTION_PATTERN.test(nameLower)
  )
}

function inferRepTwoThreeWeekCallbackDeadline(
  activityName: string,
  transcript: string,
  committedAt: Date,
): string | null {
  if (!isRepTwoThreeWeekCallBackTask(activityName, transcript)) return null
  const agreedWeeks = inferAgreedCallBackWeeksFromTranscript(transcript)
  if (agreedWeeks !== null) {
    return formatStoreDateOnlyPlusDays(committedAt, agreedWeeks * 7)
  }
  return formatStoreDateOnlyPlusDays(committedAt, REP_TWO_THREE_WEEK_CALLBACK_DAYS)
}

function applyRepTwoThreeWeekCallBackActivity(
  activity: ExtractedCallActivity,
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity {
  if (!isRepTwoThreeWeekCallBackTask(activity.name, transcript)) return activity
  const agreedWeeks = inferAgreedCallBackWeeksFromTranscript(transcript)
  const days = agreedWeeks !== null ? agreedWeeks * 7 : REP_TWO_THREE_WEEK_CALLBACK_DAYS
  return {
    name: buildRepTwoThreeWeekCallBackName(transcript),
    deadline: formatStoreDateOnlyPlusDays(committedAt, days),
  }
}

function isOnSiteEstimateActivity(name: string): boolean {
  const lower = name.toLowerCase()
  if (/\bsend\b/.test(lower) && /\b(?:quote|estimate|pricing)\b/.test(lower)) {
    return false
  }
  if (
    /\bschedule\b/.test(lower) &&
    /\b(?:estimate|measurement|on[- ]?site|visit)\b/.test(lower)
  ) {
    return true
  }
  if (/\b(?:on[- ]?site|be on-site)\b/.test(lower) && /\bestimate\b/.test(lower)) {
    return true
  }
  return (
    /\b(?:estimate|measurement)\b/.test(lower) &&
    /\b(?:visit|measure|appointment)\b/.test(lower)
  )
}

function transcriptConfirmsOnsiteEstimateAtTime(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  const estimateContext =
    /\b(?:estimate|measurement|measure|take some measurements)\b/.test(lower) ||
    /\b(?:stop by|come over|be here)\b/.test(lower)
  if (!estimateContext) return false
  return (
    /\b(?:see you|i(?:'ll| will) be there|be here|stop by)\b[^.]{0,60}\b(?:at\s+)?\d{1,2}/i.test(
      transcript,
    ) ||
    /\bif you can be here at\s+\d/i.test(lower) ||
    (/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:pm|am)\b/.test(lower) &&
      /\b(?:awesome|works|good|yes|today)\b/.test(lower))
  )
}

function parseOnsiteEstimateAppointmentTime(
  transcript: string,
  committedAt: Date,
): string | null {
  const chunks = transcript
    .split(/(?<=[.?!])\s+/)
    .map(chunk => chunk.trim())
    .filter(Boolean)

  const timedChunks = chunks.filter(chunk => {
    const lower = chunk.toLowerCase()
    if (!EXPLICIT_TIME_PATTERN.test(lower)) return false
    if (/\b(?:shop|store|business)\s+close/.test(lower)) return false
    return /\b(?:estimate|measurement|measure|be here|stop by|see you|there at|come|5:?\d{2})\b/.test(
      lower,
    )
  })

  for (const chunk of timedChunks) {
    const parsed = parseExplicitDeadlineFromText(chunk.toLowerCase(), committedAt)
    if (parsed && isTimedDeadline(parsed)) return parsed
  }

  if (/\b(?:estimate|measurement|measure|take some measurements)\b/i.test(transcript)) {
    const parsed = parseExplicitDeadlineFromText(transcript.toLowerCase(), committedAt)
    if (parsed && isTimedDeadline(parsed)) return parsed
  }

  return null
}

function onsiteEstimateReminderDeadline(
  appointmentIso: string,
  committedAt: Date,
): string {
  const appointmentMs = new Date(appointmentIso).getTime()
  const reminderMs = Math.max(
    appointmentMs - ONSITE_ESTIMATE_LEAD_MINUTES * 60_000,
    committedAt.getTime(),
  )
  return formatUtcIsoDateTime(new Date(reminderMs))
}

function inferOnsiteEstimateReminderDeadline(
  activityName: string,
  transcript: string,
  committedAt: Date,
): string | null {
  if (!isOnSiteEstimateActivity(activityName)) return null
  if (!transcriptConfirmsOnsiteEstimateAtTime(transcript)) return null
  const appointment = parseOnsiteEstimateAppointmentTime(transcript, committedAt)
  if (!appointment) return null
  return onsiteEstimateReminderDeadline(appointment, committedAt)
}

function applyOnSiteEstimateActivity(
  activity: ExtractedCallActivity,
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity {
  if (!isOnSiteEstimateActivity(activity.name)) return activity
  if (!transcriptConfirmsOnsiteEstimateAtTime(transcript)) return activity
  const appointment = parseOnsiteEstimateAppointmentTime(transcript, committedAt)
  if (!appointment) return activity
  return {
    name: CONFIRMED_ONSITE_ESTIMATE_NAME,
    deadline: onsiteEstimateReminderDeadline(appointment, committedAt),
  }
}

function isVoicemailFollowUpActivity(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    /\bfollow[- ]?up\b/.test(lower) ||
    /\bconfirm\s+interest\b/.test(lower) ||
    /\bcall\s+back\b/.test(lower)
  )
}

function isDeadlineOnCommittedStoreDay(
  deadline: string,
  committedAt: Date,
  dayOffset: number,
): boolean {
  const expected = formatStoreDateOnlyPlusDays(committedAt, dayOffset)
  const trimmed = deadline.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed === expected
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return false
  return formatStoreDateOnlyPlusDays(parsed, 0) === expected
}

function applyVoicemailFollowUpDeadlineRules(
  deadline: string | null,
  activityName: string,
  committedAt: Date,
): string | null {
  if (!isVoicemailFollowUpActivity(activityName)) return deadline
  if (!deadline) return null
  const normalized = normalizeTimedDeadline(deadline)
  if (!normalized) return null
  if (isDeadlineOnCommittedStoreDay(normalized, committedAt, 0)) return normalized
  if (isDeadlineOnCommittedStoreDay(normalized, committedAt, 1)) return normalized
  return null
}

function isQuoteOrEstimateActivity(name: string): boolean {
  const lower = name.toLowerCase()
  if (isCallBackActivity(lower)) return false
  if (/\bsend\b/.test(lower) && /\b(quote|estimate|pricing|bid)\b/.test(lower)) {
    return true
  }
  return (
    /\b(quote|estimate|pricing|bid)\b/.test(lower) &&
    /\b(?:send|deliver|email)\b/.test(lower)
  )
}

function isSendLinkStyleActivity(name: string): boolean {
  return (
    /\bsend\b/.test(name) &&
    /\b(link|option|inventory|website|granite|stone|sample|pricing)\b/.test(name)
  )
}

function isSalespersonSendActivity(name: string): boolean {
  const lower = name.toLowerCase()
  return /\bsend\b/.test(lower) && !isCustomerPhotoRequestActivity(lower)
}

function isSoonSendDeadline(activityName: string, transcriptLower: string): boolean {
  const nameLower = activityName.toLowerCase()
  if (!isSalespersonSendActivity(nameLower)) return false
  if (IMMEDIATE_DEADLINE_PATTERN.test(nameLower)) return true
  return (
    /\b(?:i(?:'ll| will)|we will)\s+send\b[^.]{0,180}\b(?:a little (?:bit )?later|shortly|right away|right now|immediately|asap|now)\b/.test(
      transcriptLower,
    ) ||
    /\bsend you the link\b[^.]{0,80}\b(?:a little (?:bit )?later|shortly)\b/.test(
      transcriptLower,
    ) ||
    /\bsend\b[^.]{0,120}\b(?:a little (?:bit )?later|shortly)\b/.test(
      transcriptLower,
    ) ||
    /\b(?:a little (?:bit )?later|shortly)\b[^.]{0,100}\b(?:send|sending)\b[^.]{0,100}\b(?:the )?(?:link|options?|inventory|website)\b/.test(
      transcriptLower,
    )
  )
}

function isQuoteByTomorrowContext(
  nameHaystack: string,
  deadlineHaystack: string,
  transcriptLower: string,
): boolean {
  if (!isQuoteOrEstimateActivity(nameHaystack)) return false
  if (
    /\b(?:quote|estimate|pricing).{0,80}\bby tomorrow\b/.test(transcriptLower) ||
    /\bby tomorrow.{0,80}\b(?:quote|estimate|pricing)\b/.test(transcriptLower) ||
    (/\b(?:i(?:'ll| will)|we will)\b/.test(transcriptLower) &&
      /\b(?:quote|estimate|pricing)\b/.test(transcriptLower) &&
      /\bby tomorrow\b/.test(transcriptLower))
  ) {
    return true
  }
  return (
    TOMORROW_DEADLINE_PATTERN.test(nameHaystack) ||
    TOMORROW_DEADLINE_PATTERN.test(deadlineHaystack)
  )
}

function hasExplicitTimeMention(haystacks: string[]): boolean {
  return haystacks.some(h => EXPLICIT_TIME_PATTERN.test(h) || /T\d{2}:\d{2}/.test(h))
}

function coerceDayOnlyCommitment(
  normalizedDeadline: string,
  activityName: string,
  transcriptLower: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(normalizedDeadline)) return false
  if (isQuoteOrEstimateActivity(activityName)) return false
  const nameHaystack = activityName.toLowerCase()
  const deadlineHaystack = normalizedDeadline.toLowerCase()
  const todayMentioned =
    TODAY_DEADLINE_PATTERN.test(nameHaystack) ||
    TODAY_DEADLINE_PATTERN.test(deadlineHaystack) ||
    (/\b(?:i(?:'ll| will)|we will)\b/.test(transcriptLower) &&
      /\btoday\b/.test(transcriptLower))
  if (!todayMentioned) return false
  return !hasExplicitTimeMention([nameHaystack, deadlineHaystack, transcriptLower])
}

function normalizeTimedDeadline(deadline: string): string | null {
  const trimmed = deadline.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const hasTimeZone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)
  const parsed = new Date(hasTimeZone ? trimmed : `${trimmed}Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function to24Hour(
  hour12: number,
  meridiem: string | undefined,
  matchedText: string,
): number {
  const normalizedMeridiem =
    meridiem?.toLowerCase() ??
    (/\bpm\b/i.test(matchedText)
      ? 'pm'
      : /\bam\b/i.test(matchedText)
        ? 'am'
        : undefined)
  let hour = hour12
  if (normalizedMeridiem === 'pm' && hour < 12) hour += 12
  if (normalizedMeridiem === 'am' && hour === 12) hour = 0
  if (!normalizedMeridiem && hour >= 1 && hour <= 6) hour += 12
  return hour
}

function getActivityTranscriptWindows(
  activityName: string,
  transcript: string,
): string[] {
  const lower = activityName.toLowerCase()
  const chunks = transcript
    .split(/(?<=[.?!])\s+/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
  if (chunks.length === 0) return [transcript.toLowerCase()]

  const terms: string[] = []
  if (
    isSendLinkStyleActivity(lower) ||
    (/\bsend\b/.test(lower) && /\blink\b/.test(lower))
  ) {
    terms.push('send', 'link', 'text', 'options', 'inventory', 'website')
  }
  if (isEdgePhotoSendActivityName(lower)) {
    terms.push('edge', 'picture', 'photo', 'pic')
  }
  if (isCallBackActivity(lower)) {
    terms.push(
      'call',
      'follow',
      'week',
      'friday',
      'monday',
      'next',
      'check',
      'quote',
      'questions',
    )
  }
  if (isQuoteOrEstimateActivity(lower)) {
    terms.push('quote', 'estimate', 'pricing', 'bid')
  }
  if (isOnSiteEstimateActivity(lower)) {
    terms.push(
      'estimate',
      'measurement',
      'measure',
      'be here',
      'stop by',
      'see you',
      'today',
    )
  }
  if (isLongLeadRequestActivity(lower) || isCustomerPhotoRequestActivity(lower)) {
    terms.push('photo', 'picture', 'pic', 'kitchen', 'send', 'material', 'countertop')
  }
  if (terms.length === 0) {
    terms.push(...lower.split(/\s+/).filter(word => word.length > 3))
  }

  const hits = chunks.filter(chunk => {
    const chunkLower = chunk.toLowerCase()
    return terms.some(term => chunkLower.includes(term))
  })

  return hits.length > 0
    ? hits.map(chunk => chunk.toLowerCase())
    : [transcript.toLowerCase()]
}

function parseExplicitDeadlineFromText(text: string, committedAt: Date): string | null {
  const lower = text.toLowerCase()

  const customerNextWeekday = lower.match(
    /\b(?:you\s+can\s+call\s+me|call\s+me)\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (customerNextWeekday?.[1]) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, customerNextWeekday[1], true),
    )
  }

  const nextWeekday = lower.match(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (nextWeekday?.[1]) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, nextWeekday[1], true),
    )
  }

  const weekdayOnly = lower.match(
    /\b(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (weekdayOnly?.[1] && !nextWeekday) {
    return formatStoreDateOnlyPlusDays(
      committedAt,
      daysUntilWeekdayLabel(committedAt, weekdayOnly[1], false),
    )
  }

  let dayOffset: number | null = null
  if (/\btomorrow\b/.test(lower)) dayOffset = 1
  else if (/\btoday\b/.test(lower)) dayOffset = 0
  else if (/\b(?:this\s+afternoon|this\s+evening|tonight)\b/.test(lower)) dayOffset = 0

  const timePatterns = [
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    /\b(\d{1,2})\s*pm\b/i,
    /\b(\d{1,2})\s*am\b/i,
  ]

  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (!match) continue
    const hourRaw = Number(match[1])
    const minute = match[2] ? Number(match[2]) : 0
    if (!Number.isFinite(hourRaw) || !Number.isFinite(minute)) continue
    const matchedText = match[0]
    const meridiem = match[3]
    const hour = to24Hour(hourRaw, meridiem, matchedText)
    const offset = dayOffset ?? 0
    const { year, month, day } = addStoreCalendarDays(committedAt, offset)
    return zonedWallTimeToUtcIso(
      year,
      month,
      day,
      hour,
      minute,
      STORE_BUSINESS_TIMEZONE,
    )
  }

  if (dayOffset !== null) {
    return formatStoreDateOnlyPlusDays(committedAt, dayOffset)
  }

  return null
}

function inferExplicitDeadlineForActivity(
  activityName: string,
  transcript: string,
  committedAt: Date,
): string | null {
  const windows = getActivityTranscriptWindows(activityName, transcript)
  for (const window of windows) {
    const parsed = parseExplicitDeadlineFromText(window, committedAt)
    if (parsed) return parsed
  }
  return null
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function isPhotoRequestActivity(name: string): boolean {
  return (
    /\b(request|wait for|receive)\b/.test(name) &&
    /\b(photo|picture|pic|image)/.test(name)
  )
}

function isCustomerPhotoRequestActivity(name: string): boolean {
  return (
    isPhotoRequestActivity(name) ||
    (/\b(photo|picture|pic)/.test(name) &&
      /\b(kitchen|countertop|counter)\b/.test(name))
  )
}

function sanitizeActivityName(name: string): string {
  return stripCalendarDatesFromActivityName(
    name.replace(/\s+from\s+[A-Za-z]+\s*$/i, '').trim(),
  )
}

function isEdgePhotoSendActivityName(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    /\bsend\b/.test(lower) &&
    /\b(edge|profile)\b/.test(lower) &&
    /\b(photo|picture|pic)s?\b/.test(lower)
  )
}

function canonicalEdgePhotoSendName(lower: string): string {
  if (/\bsquare(d)?\b/.test(lower)) return 'Send square edge profile photos'
  if (/\bflat\b/.test(lower)) return 'Send flat edge profile photos'
  if (/\b(?:slightly )?rounded\b/.test(lower)) return 'Send rounded edge profile photos'
  if (/\bbullnose\b/.test(lower)) return 'Send bullnose edge profile photos'
  if (/\bogee\b/.test(lower)) return 'Send ogee edge profile photos'
  if (/\b1\/4\s*bevel\b/.test(lower)) return 'Send 1/4 bevel edge profile photos'
  if (/\b1\/2\s*bevel\b/.test(lower)) return 'Send 1/2 bevel edge profile photos'
  if (/\bbevel\b/.test(lower)) return 'Send bevel edge profile photos'
  return 'Send edge profile photos'
}

function canonicalActivityName(name: string): string {
  const sanitized = sanitizeActivityName(name)
  const lower = sanitized.toLowerCase()
  if (isCustomerPhotoRequestActivity(lower)) {
    return 'Request kitchen photos'
  }
  if (isEdgePhotoSendActivityName(lower)) {
    return canonicalEdgePhotoSendName(lower)
  }
  return sanitized
}

function normalizeActivityDedupKey(name: string): string {
  const lower = canonicalActivityName(name).toLowerCase()
  if (isCustomerPhotoRequestActivity(lower)) {
    return 'request-customer-photos'
  }
  if (/\bsend\b/.test(lower) && /\b(link|option|inventory|website)\b/.test(lower)) {
    return 'send-options-link'
  }
  if (isEdgePhotoSendActivityName(lower)) {
    return 'send-edge-profile-photos'
  }
  return lower.replace(/[^a-z0-9]+/g, ' ').trim()
}

function transcriptHasRepEdgePhotoOffer(transcriptLower: string): boolean {
  const edgeDiscussed =
    /\b(?:flat|square|rounded|bevel|bullnose|ogee)\b[^.]{0,100}\bedges?\b/.test(
      transcriptLower,
    ) ||
    /\bedges?\b[^.]{0,100}\b(?:flat|square|rounded|bevel|bullnose|ogee)\b/.test(
      transcriptLower,
    ) ||
    /\bprefer\b[^.]{0,140}\bedges?\b/.test(transcriptLower)

  if (!edgeDiscussed) return false

  return (
    /\bedges?\b[\s\S]{0,280}\b(?:i(?:'ll| will)|we will|can also)\s+send\b[\s\S]{0,140}\b(?:picture|photo|pic)s?\b/.test(
      transcriptLower,
    ) ||
    /\b(?:i(?:'ll| will)|we will|can also)\s+send\b[\s\S]{0,140}\b(?:picture|photo|pic)s?\b[\s\S]{0,280}\bedges?\b/.test(
      transcriptLower,
    )
  )
}

function hasEdgePhotoSendActivity(activities: ExtractedCallActivity[]): boolean {
  return activities.some(activity => isEdgePhotoSendActivityName(activity.name))
}

function edgeProfileLabelFromTranscript(transcriptLower: string): string {
  if (!/\bedges?\b/.test(transcriptLower)) return ''
  if (/\bsquare(d)?\b/.test(transcriptLower)) return 'square'
  if (/\bflat\b/.test(transcriptLower)) return 'flat'
  if (/\b(?:slightly )?rounded\b/.test(transcriptLower)) return 'rounded'
  if (/\bbullnose\b/.test(transcriptLower)) return 'bullnose'
  if (/\bogee\b/.test(transcriptLower)) return 'ogee'
  if (/\b1\/4\s*bevel\b/.test(transcriptLower)) return '1/4 bevel'
  if (/\b1\/2\s*bevel\b/.test(transcriptLower)) return '1/2 bevel'
  if (/\bbevel\b/.test(transcriptLower)) return 'bevel'
  return ''
}

function buildEdgePhotoSendActivityName(transcript: string): string {
  const profile = edgeProfileLabelFromTranscript(transcript.toLowerCase())
  if (profile) return canonicalEdgePhotoSendName(`send ${profile} edge profile photos`)
  return canonicalEdgePhotoSendName('send edge profile photos')
}

function supplementEdgePhotoSendActivity(
  activities: ExtractedCallActivity[],
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity[] {
  const transcriptLower = transcript.toLowerCase()
  if (!transcriptHasRepEdgePhotoOffer(transcriptLower)) return activities
  if (hasEdgePhotoSendActivity(activities)) return activities

  const name = buildEdgePhotoSendActivityName(transcript)
  const deadline = applyActivityDeadlineRules(null, name, committedAt, transcript)
  return [...activities, { name, deadline }]
}

function inferDeadlineFromTranscript(
  activityName: string,
  transcript: string,
  committedAt: Date,
): string | null {
  const nameLower = activityName.toLowerCase()
  const transcriptLower = transcript.toLowerCase()

  const explicit = inferExplicitDeadlineForActivity(
    activityName,
    transcript,
    committedAt,
  )
  if (explicit) return explicit

  if (isCustomerPhotoRequestActivity(nameLower)) {
    const customerSendsTomorrow =
      /\b(?:she|he|they|customer)\b[^.]{0,120}\btomorrow\b[^.]{0,120}\b(?:photo|picture|pic|kitchen|countertop)\b/.test(
        transcriptLower,
      ) ||
      /\b(?:photo|picture|pic|kitchen|countertop)\b[^.]{0,120}\btomorrow\b/.test(
        transcriptLower,
      ) ||
      (/\bi(?:'ll| will) send (?:you )?(?:the )?(?:photo|picture|pic|kitchen)/.test(
        transcriptLower,
      ) &&
        /\btomorrow\b/.test(transcriptLower))

    if (customerSendsTomorrow) {
      return formatStoreDateOnlyPlusDays(committedAt, 1)
    }
  }

  if (isQuoteOrEstimateActivity(nameLower)) {
    if (
      /\bby tomorrow\b/.test(transcriptLower) &&
      /\b(?:quote|estimate|pricing)\b/.test(transcriptLower)
    ) {
      return storeCloseDeadlineOnCallDay(committedAt, 0)
    }
  }

  if (isSendLinkStyleActivity(nameLower)) {
    if (isSoonSendDeadline(activityName, transcriptLower)) {
      return formatUtcIsoDateTime(addMinutes(committedAt, 30))
    }
    if (
      /\b(?:i(?:'ll| will)|we will)\s+send\b[^.]{0,120}\btoday\b/.test(
        transcriptLower,
      ) ||
      /\bsend\b[^.]{0,80}\btoday\b/.test(transcriptLower)
    ) {
      return formatStoreDateOnlyPlusDays(committedAt, 0)
    }
  }

  return null
}

function applyActivityDeadlineRules(
  deadline: string | null,
  activityName: string,
  committedAt: Date,
  transcript: string,
): string | null {
  if (isVoicemailFollowUpActivity(activityName)) {
    return applyVoicemailFollowUpDeadlineRules(deadline, activityName, committedAt)
  }

  const repTwoThreeWeekDeadline = inferRepTwoThreeWeekCallbackDeadline(
    activityName,
    transcript,
    committedAt,
  )
  if (repTwoThreeWeekDeadline) {
    return repTwoThreeWeekDeadline
  }

  const estimateReminder = inferOnsiteEstimateReminderDeadline(
    activityName,
    transcript,
    committedAt,
  )
  if (estimateReminder) {
    return estimateReminder
  }

  if (isCallBackActivity(activityName)) {
    const agreedCallBack = inferAgreedCallBackDeadlineFromTranscript(
      transcript,
      committedAt,
    )
    if (agreedCallBack) return agreedCallBack
  }

  const nameHaystack = activityName.toLowerCase()
  const deadlineHaystack = (deadline ?? '').toLowerCase()
  const transcriptLower = transcript.toLowerCase()

  const explicitFromTranscript = inferExplicitDeadlineForActivity(
    activityName,
    transcript,
    committedAt,
  )
  if (explicitFromTranscript) {
    return explicitFromTranscript
  }

  if (isSoonSendDeadline(activityName, transcriptLower)) {
    return formatUtcIsoDateTime(addMinutes(committedAt, 30))
  }

  if (isQuoteOrEstimateActivity(nameHaystack)) {
    if (isQuoteByTomorrowContext(nameHaystack, deadlineHaystack, transcriptLower)) {
      return storeCloseDeadlineOnCallDay(committedAt, 0)
    }
    if (
      TODAY_DEADLINE_PATTERN.test(nameHaystack) ||
      TODAY_DEADLINE_PATTERN.test(deadlineHaystack) ||
      /\b(?:before close|end of day|by close|closing at|close at|6\s*pm|6:00)\b/.test(
        transcriptLower,
      )
    ) {
      return storeCloseDeadlineOnCallDay(committedAt, 0)
    }
  }

  if (deadline) {
    const normalized = normalizeTimedDeadline(deadline)
    if (normalized) {
      if (coerceDayOnlyCommitment(normalized, activityName, transcriptLower)) {
        return formatStoreDateOnlyPlusDays(committedAt, 0)
      }
      if (isSendLinkStyleActivity(nameHaystack)) {
        const callDay = formatStoreDateOnlyPlusDays(committedAt, 0)
        if (
          normalized === callDay ||
          normalized.startsWith(`${callDay}T`) ||
          TODAY_DEADLINE_PATTERN.test(nameHaystack) ||
          TODAY_DEADLINE_PATTERN.test(deadlineHaystack)
        ) {
          return callDay
        }
      }
      return normalized
    }
  }

  if (
    TOMORROW_DEADLINE_PATTERN.test(nameHaystack) ||
    TOMORROW_DEADLINE_PATTERN.test(deadlineHaystack)
  ) {
    return formatStoreDateOnlyPlusDays(committedAt, 1)
  }

  if (
    TODAY_DEADLINE_PATTERN.test(nameHaystack) ||
    TODAY_DEADLINE_PATTERN.test(deadlineHaystack)
  ) {
    return formatStoreDateOnlyPlusDays(committedAt, 0)
  }

  return inferDeadlineFromTranscript(activityName, transcript, committedAt)
}

function deduplicateActivities(
  activities: ExtractedCallActivity[],
): ExtractedCallActivity[] {
  const byKey = new Map<string, ExtractedCallActivity>()

  for (const activity of activities) {
    const name = canonicalActivityName(activity.name)
    const key = normalizeActivityDedupKey(name)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, { name, deadline: activity.deadline })
      continue
    }

    byKey.set(key, {
      name: existing.name,
      deadline: existing.deadline ?? activity.deadline,
    })
  }

  return Array.from(byKey.values())
}

function isTimedDeadline(deadline: string): boolean {
  const trimmed = deadline.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false
  return !Number.isNaN(new Date(trimmed).getTime())
}

function isLongLeadRequestActivity(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    isCustomerPhotoRequestActivity(lower) ||
    (/\brequest\b/.test(lower) && !/\bsend\b/.test(lower))
  )
}

function activitySchedulingOrder(name: string): number {
  const lower = name.toLowerCase()
  if (isLongLeadRequestActivity(lower)) return 0
  if (/\bsend\b/.test(lower) && /\b(link|option|inventory|website)\b/.test(lower)) {
    return 1
  }
  if (
    isEdgePhotoSendActivityName(lower) ||
    (/\bsend\b/.test(lower) && /\b(photo|picture|pic)s?\b/.test(lower))
  ) {
    return 2
  }
  if (isQuoteOrEstimateActivity(lower)) return 3
  return 2
}

function quoteMinimumDeadlineIso(committedAt: Date): string {
  return formatUtcIsoDateTime(addMinutes(committedAt, QUOTE_MINIMUM_LEAD_MINUTES))
}

function enforceQuoteMinimumDeadline(
  deadline: string | null,
  activityName: string,
  committedAt: Date,
): string | null {
  if (!isQuoteOrEstimateActivity(activityName)) return deadline
  const minimumIso = quoteMinimumDeadlineIso(committedAt)
  const minimumMs = new Date(minimumIso).getTime()
  if (!deadline) return minimumIso
  const trimmed = deadline.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (!isTimedDeadline(trimmed)) return minimumIso
  const currentMs = new Date(trimmed).getTime()
  if (currentMs < minimumMs) return minimumIso
  return trimmed
}

function applyQuoteMinimumLeadTime(
  activities: ExtractedCallActivity[],
  committedAt: Date,
): ExtractedCallActivity[] {
  return activities.map(activity => ({
    ...activity,
    deadline: enforceQuoteMinimumDeadline(
      activity.deadline,
      activity.name,
      committedAt,
    ),
  }))
}

function minutesBeforeNextActivity(name: string): number {
  const lower = name.toLowerCase()
  if (isQuoteOrEstimateActivity(lower)) return QUOTE_MINIMUM_LEAD_MINUTES
  if (isLongLeadRequestActivity(lower)) return 2
  if (
    isEdgePhotoSendActivityName(lower) ||
    (/\bsend\b/.test(lower) && /\b(photo|picture|pic)s?\b/.test(lower))
  ) {
    return 2
  }
  if (/\bsend\b/.test(lower)) return 2
  return 2
}

function staggerTimedDeadlines(
  activities: ExtractedCallActivity[],
): ExtractedCallActivity[] {
  let lastTimedDeadlineMs: number | null = null
  let lastActivityName: string | null = null

  return activities.map(activity => {
    if (!activity.deadline || !isTimedDeadline(activity.deadline)) {
      lastTimedDeadlineMs = null
      lastActivityName = null
      return activity
    }

    const currentMs = new Date(activity.deadline).getTime()

    if (lastTimedDeadlineMs === null || lastActivityName === null) {
      lastTimedDeadlineMs = currentMs
      lastActivityName = activity.name
      return activity
    }

    const gapMs = minutesBeforeNextActivity(lastActivityName) * 60_000
    const assignedMs = Math.max(currentMs, lastTimedDeadlineMs + gapMs)
    lastTimedDeadlineMs = assignedMs
    lastActivityName = activity.name

    if (assignedMs === currentMs) return activity
    return { ...activity, deadline: new Date(assignedMs).toISOString() }
  })
}

function finalizeExtractedActivities(
  activities: ExtractedCallActivity[],
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity[] {
  const deduped = deduplicateActivities(activities)
  const supplemented = supplementEdgePhotoSendActivity(deduped, committedAt, transcript)
  const dedupedAgain = deduplicateActivities(supplemented)
  const sorted = [...dedupedAgain].sort(
    (a, b) => activitySchedulingOrder(a.name) - activitySchedulingOrder(b.name),
  )
  const staggered = applyQuoteMinimumLeadTime(
    staggerTimedDeadlines(sorted),
    committedAt,
  )
  return staggered.map(activity =>
    applyAgreedCallBackActivity(
      applyOnSiteEstimateActivity(
        applyRepTwoThreeWeekCallBackActivity(activity, committedAt, transcript),
        committedAt,
        transcript,
      ),
      committedAt,
      transcript,
    ),
  )
}

function resolveActivityName(name: string | undefined): string | null {
  const trimmed = name?.trim()
  return trimmed ? trimmed : null
}

function resolveActivityDeadline(deadline: string | null | undefined): string | null {
  if (!deadline || typeof deadline !== 'string') return null
  const trimmed = deadline.trim()
  return trimmed ? trimmed : null
}

function processActivityItem(
  item: z.infer<typeof activityItemSchema>,
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity | null {
  const rawName = resolveActivityName(item.name)
  if (!rawName) return null

  const name = canonicalActivityName(rawName)
  const rawDeadline = resolveActivityDeadline(item.deadline)
  const deadline = enforceQuoteMinimumDeadline(
    applyActivityDeadlineRules(rawDeadline, name, committedAt, transcript),
    name,
    committedAt,
  )

  return { name, deadline }
}

function extractActivitiesFromResponse(
  json: unknown,
  committedAt: Date,
  transcript: string,
): ExtractedCallActivity[] {
  const parsed = activitiesResponseSchema.safeParse(json)
  if (!parsed.success) {
    return [{ name: DEFAULT_ACTIVITY_NAME, deadline: null }]
  }

  const items: z.infer<typeof activityItemSchema>[] = []

  if (parsed.data.activities && parsed.data.activities.length > 0) {
    items.push(...parsed.data.activities)
  } else if (parsed.data.name?.trim()) {
    items.push({ name: parsed.data.name, deadline: parsed.data.deadline })
  }

  const activities: ExtractedCallActivity[] = []
  for (const item of items) {
    const processed = processActivityItem(item, committedAt, transcript)
    if (processed) activities.push(processed)
  }

  if (activities.length > 0) {
    return finalizeExtractedActivities(activities, committedAt, transcript)
  }

  return [{ name: DEFAULT_ACTIVITY_NAME, deadline: null }]
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to authorize', 401)
  }

  let parsed: z.infer<typeof summarizeSchema>
  try {
    parsed = summarizeSchema.parse(await request.json())
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Invalid request data', 400)
  }

  const transcript = parsed.transcript.trim()
  if (!transcript) {
    return createErrorResponse('Transcript is empty', 400)
  }

  const callStartedAt = parseIsoDate(parsed.callStartedAt)
  const committedAt = parseIsoDate(parsed.committedAt)
  const isVoicemail = resolveIsVoicemail(parsed.isVoicemail === true, transcript)

  const callReference = isVoicemail
    ? `Activity creation time for relative deadlines (ISO): ${committedAt.toISOString()}`
    : parsed.callStartedAt?.trim()
      ? `Call date/time for relative deadlines (ISO): ${parsed.callStartedAt.trim()}`
      : `Call date/time for relative deadlines (ISO): ${callStartedAt.toISOString()}`

  if (isVoicemail && isVoicemailGreetingOnly(transcript)) {
    const activities = finalizeExtractedActivities(
      [{ name: VOICEMAIL_GREETING_ACTIVITY_NAME, deadline: null }],
      committedAt,
      transcript,
    )
    return new Response(JSON.stringify({ activities }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (isVoicemail && countWords(transcript) <= VOICEMAIL_ACTIVITY_SKIP_AI_WORDS) {
    const activities = finalizeExtractedActivities(
      [{ name: VOICEMAIL_DEFAULT_ACTIVITY_NAME, deadline: null }],
      committedAt,
      transcript,
    )
    return new Response(JSON.stringify({ activities }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const voicemailActivitySystem = `Extract follow-up tasks from a sales voicemail for a countertop company CRM.

Return JSON only: {"activities": [{"name": string, "deadline": string | null}, ...]}

Focus on what the salesperson asked the customer to do next (confirm interest, call back, send photos). Usually one activity such as "Follow-up to confirm interest".

Rules for deadline: null unless the rep gives a follow-up due date for this task (today or tomorrow relative to activity creation). Never use project timing (May, months ago, ready in) as the deadline.

No commitments -> {"activities":[]}

${callReference}`

  const liveCallActivitySystem = `Extract follow-up tasks from a phone call for a CRM activity list. The note records job facts only; every commitment from the call belongs here as activities.

Return JSON only: {"activities": [{"name": string, "deadline": string | null}, ...]}

Create a separate activity for each distinct commitment (different action or different due date). Never merge unrelated tasks into one activity.

Include when stated:
- Salesperson will send something (inventory link, website, granite/stone options, quote, edge photos, samples)
- Customer will send something (kitchen photos, countertop photos, material photos)
- Salesperson offers or agrees to call back (including "call you in two or three weeks")
- On-site estimate when the rep will go to the customer to measure or quote (not when only scheduling is still being negotiated)
- Other follow-up the rep committed to
- Do not create an outbound call-back activity when only the customer said they will call the company later
- When edge style was discussed and the rep offers to send edge photos, add a separate edge-photo activity—do not merge with link or customer-photo tasks

Rules for name:
- Clear imperative title, usually 4-14 words with brief context (why you are calling back, e.g. after vacation, after trip)
- Never include customer or caller names
- Never include calendar dates in the name—use deadline only for when the task is due
- When the rep offers "call you in two weeks" and the customer confirms a different number (e.g. "in three weeks, yeah"), use the customer's confirmed number of weeks for the deadline
- For "two or three weeks" call-back from the salesperson with no customer pick: set deadline null; server uses about two weeks
- For an agreed call-back in N weeks (a week, in a week, about a week, one week, two weeks, three weeks, etc.): set deadline null; server computes the date from the transcript
- This company sells stone countertops. When sending stone options, samples, links, or pricing, include the stone type if specified (granite, quartz, marble, etc.)
- Examples: "Send granite inventory link", "Request kitchen photos", "Send edge profile photos", "Call back, follow up after vacation", "Call back, follow up on countertop project after vacation to Colombia"
- When the rep already agreed to be on-site at a specific time for an estimate, use name "Be on-site for estimate"—not "Schedule on-site measurement visit" or "Schedule on-site estimate visit"
- Only use "Schedule ... estimate" when an estimate time is not yet agreed

Rules for deadline (prefer setting a deadline when timing was discussed; null only when no timing was discussed for that task):
- Always set a deadline when the call gives a date or time for that task—never omit timing that was stated
- YYYY-MM-DD when only a calendar day was committed (no specific clock time)—use the resolved calendar day, not vague wording
- ISO 8601 UTC datetime with Z suffix when a specific clock time was committed (e.g. at 3 pm, 6:00, this afternoon)
- Resolve relative phrases using the call date below: today, tomorrow, next Monday, next Friday, this afternoon, end of day
- When the customer or rep agrees to call back on a named day (especially "next Friday", "call me next Friday"), set deadline to that calendar day (YYYY-MM-DD)—never today or the activity creation time unless they explicitly said today
- If the rep offers "Friday" and the customer says "next Friday", use the later Friday (the week after the nearest Friday), not today
- Quote the call literally when choosing the day: if they said tomorrow, the deadline day must be tomorrow relative to the call date
- "Right away", "now", "immediately", "ASAP", "shortly", "a little later", "a little bit later" when sending a link or options → omit deadline; server sets 30 minutes from activity creation
- "I'll send the link today" (or similar send-today, no time) → YYYY-MM-DD for the call day only, never a datetime
- "Tomorrow" for non-quote tasks (e.g. customer sends photos) → YYYY-MM-DD for the day after the call
- Quote or estimate with "by tomorrow" or before the store closes → omit deadline; server sets due today at 4:00 PM store time (two hours before 6:00 PM close), but never earlier than one hour after activity creation
- Salesperson: "Would you like me to call you in two or three weeks?" while customer is in litigation → {"name":"Call back, check if litigation is finished","deadline":null}
- Rep and customer agree rep will be on-site today at 5:30 pm for an estimate → {"name":"Be on-site for estimate","deadline":null} (server sets due 30 minutes before the appointment time)
- Rep offers to call Friday; customer says "call me next Friday" and rep agrees → {"name":"Call back, follow up on quote","deadline":"YYYY-MM-DD for next Friday after call date"}

Examples:
- Salesperson discusses square edges, then says "I can also send you pictures"
  -> include {"name":"Send square edge profile photos","deadline":null} in addition to any link or customer-photo tasks
- Salesperson: "I'll send the inventory link today" AND customer: "I'll send you pictures tomorrow"
  -> {"activities":[
    {"name":"Send granite inventory link","deadline":"YYYY-MM-DD call day"},
    {"name":"Request kitchen photos","deadline":"YYYY-MM-DD day after call"}
  ]}
- Salesperson: "I'll send you the link a little bit later"
  -> {"name":"Send granite inventory link","deadline":null}
- Salesperson: "I'll get you a quote by tomorrow"
  -> {"name":"Send quote","deadline":null}
- Only one vague follow-up with no timing -> single activity with deadline null
- No commitments -> {"activities":[]}

${callReference}`

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: isVoicemail ? voicemailActivitySystem : liveCallActivitySystem,
        },
        { role: 'user', content: transcript },
      ],
      ...(isVoicemail ? { max_tokens: 250 } : {}),
    })

    const rawContent = completion.choices[0]?.message?.content ?? '{}'
    let json: unknown
    try {
      json = JSON.parse(rawContent)
    } catch (error) {
      posthogClient.captureException(error)
      return createErrorResponse('Failed to parse activity response', 500)
    }

    let activities = extractActivitiesFromResponse(json, committedAt, transcript)

    if (
      isVoicemail &&
      activities.length === 1 &&
      activities[0].name === DEFAULT_ACTIVITY_NAME
    ) {
      activities = [{ ...activities[0], name: VOICEMAIL_DEFAULT_ACTIVITY_NAME }]
    }

    if (isVoicemail) {
      activities = activities.map(activity => ({
        ...activity,
        deadline: applyVoicemailFollowUpDeadlineRules(
          activity.deadline,
          activity.name,
          committedAt,
        ),
      }))
    }

    return new Response(JSON.stringify({ activities }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to extract activity', 500)
  }
}
