import type { LucideIcon } from 'lucide-react'
import { Phone, PhoneIncoming, PhoneOutgoing, Voicemail } from 'lucide-react'
import type { Nullable } from '~/types/utils'
import type { Calls200Response } from '~/utils/cloudtalk.server'

export type CallEntry = {
  callId: number
  type: Calls200Response['Cdr']['type']
  startedAt: string
  talkingTime: number
  recorded: boolean
  recordingLink: string
  agentName: string
  publicExternal: string
  isVoicemail: boolean
  notes: Calls200Response['Notes']
  tags: Calls200Response['Tags']
  ratings: Calls200Response['Ratings']
}

export type CallIconInfo = { Icon: LucideIcon; color: string }

export function mapToCallEntry(item: Calls200Response): CallEntry {
  const { Cdr, Agent, Notes, Tags, Ratings } = item
  return {
    callId: Number(Cdr.id),
    type: Cdr.type,
    startedAt: Cdr.started_at,
    talkingTime: Number(Cdr.talking_time),
    recorded: Cdr.recorded,
    recordingLink: Cdr.recording_link,
    agentName: Agent ? `${Agent.firstname} ${Agent.lastname}`.trim() : 'Unknown',
    publicExternal: Cdr.public_external,
    isVoicemail: Cdr.is_voicemail,
    notes: Notes,
    tags: Tags,
    ratings: Ratings,
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function getCallIcon(call: CallEntry): CallIconInfo {
  if (call.isVoicemail) return { Icon: Voicemail, color: 'text-amber-500' }
  if (call.type === 'internal') return { Icon: Phone, color: 'text-slate-500' }
  if (call.type === 'outgoing') {
    const noAnswer = call.talkingTime === 0
    return {
      Icon: PhoneOutgoing,
      color: noAnswer ? 'text-slate-400' : 'text-blue-600',
    }
  }
  const isMissed = call.talkingTime === 0
  return {
    Icon: PhoneIncoming,
    color: isMissed ? 'text-red-500' : 'text-green-600',
  }
}

export function getCallStatus(call: CallEntry): Nullable<string> {
  if (call.isVoicemail) return 'Voicemail'
  if (call.type === 'incoming' && call.talkingTime === 0) return 'Missed'
  if (call.type === 'outgoing' && call.talkingTime === 0) return 'No answer'
  return null
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Missed':
      return 'text-red-500'
    case 'Voicemail':
      return 'text-amber-500'
    default:
      return 'text-slate-400'
  }
}

export type CallFilterType = 'all' | 'incoming' | 'outgoing' | 'missed' | 'voicemail'

export function matchesCallFilter(call: CallEntry, filter: CallFilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'voicemail') return call.isVoicemail
  if (filter === 'missed') return call.talkingTime === 0 && call.type === 'incoming'
  return call.type === filter
}
