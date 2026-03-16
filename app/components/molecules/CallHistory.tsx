import { useQueries, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PhoneIncoming, PhoneOutgoing, Play, Square } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Spinner } from '~/components/atoms/Spinner'
import type { Nullable } from '~/types/utils'
import type { Agent, Calls200Response } from '~/utils/cloudtalk.server'

export type CallEntry = {
  callId: number
  type: Calls200Response['Cdr']['type']
  startedAt: string
  talkingTime: number
  recorded: boolean
  recordingLink: number
  agentName: string
  publicExternal: string
  isVoicemail: boolean
  notes: Calls200Response['Notes']
  tags: Calls200Response['Tags']
  ratings: Calls200Response['Ratings']
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

async function fetchAgents(): Promise<{ items: Agent[] }> {
  const res = await fetch('/api/cloudtalk/agents')
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

async function fetchUserCalls(userId: number): Promise<{ items: Calls200Response[] }> {
  const res = await fetch(`/api/cloudtalk/userCalls/${userId}`)
  if (!res.ok) throw new Error(`Failed to fetch calls for agent ${userId}`)
  return res.json()
}

function RecordingPlayer({ recordingLink }: { recordingLink: number }) {
  const [audioUrl, setAudioUrl] = useState<Nullable<string>>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handleToggle = useCallback(async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    if (audioUrl && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/cloudtalk/userCallMedia/${recordingLink}`)
      if (!res.ok) throw new Error('Failed to fetch recording')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setIsPlaying(true)
    } finally {
      setIsLoading(false)
    }
  }, [isPlaying, audioUrl, recordingLink])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [])

  return (
    <span className='inline-flex items-center'>
      <button
        type='button'
        onClick={handleToggle}
        disabled={isLoading}
        className='p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50'
      >
        {isLoading ? (
          <Spinner size={14} />
        ) : isPlaying ? (
          <Square size={14} />
        ) : (
          <Play size={14} />
        )}
      </button>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleEnded}
          autoPlay={isPlaying}
        />
      )}
    </span>
  )
}

export function CallHistory({
  phone,
  phone2,
}: {
  phone: Nullable<string>
  phone2: Nullable<string>
}) {
  const hasPhones = !!phone || !!phone2

  const normalizedPhones = [phone, phone2]
    .filter((p): p is string => !!p)
    .map(normalizePhone)

  const {
    data: agentsData,
    isLoading: agentsLoading,
    isError: agentsError,
  } = useQuery({
    queryKey: ['cloudtalk-agents'],
    queryFn: fetchAgents,
    enabled: hasPhones,
    staleTime: 5 * 60 * 1000,
  })

  const agents = agentsData?.items ?? []

  const callQueries = useQueries({
    queries: agents.map(agent => ({
      queryKey: ['cloudtalk-user-calls', agent.id],
      queryFn: () => fetchUserCalls(agent.id),
      enabled: hasPhones && agents.length > 0,
      staleTime: 2 * 60 * 1000,
    })),
  })

  const callsLoading = callQueries.some(q => q.isLoading)
  const isLoading = agentsLoading || callsLoading

  const calls: CallEntry[] = []
  const seenIds = new Set<number>()

  for (const query of callQueries) {
    if (!query.data?.items) continue
    const agent = agents[callQueries.indexOf(query)]
    for (const item of query.data.items) {
      const {
        id,
        type,
        started_at,
        talking_time,
        recorded,
        recording_link,
        public_external,
      } = item.Cdr

      if (seenIds.has(id)) continue

      const externalNormalized = normalizePhone(public_external)
      const matches = normalizedPhones.some(
        p => externalNormalized.includes(p) || p.includes(externalNormalized),
      )
      if (!matches) continue

      seenIds.add(id)
      calls.push({
        callId: id,
        type,
        startedAt: started_at,
        talkingTime: talking_time,
        recorded,
        recordingLink: recording_link,
        agentName: agent ? `${agent.firstname} ${agent.lastname}`.trim() : 'Unknown',
        publicExternal: public_external,
        isVoicemail: item.Cdr.is_voicemail,
        notes: item.Notes,
        tags: item.Tags,
        ratings: item.Ratings,
      })
    }
  }

  calls.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

  if (!hasPhones) return null

  if (agentsError) return null

  return (
    <div className='border rounded p-4'>
      <div className='text-md font-semibold mb-2'>Call History</div>

      {isLoading ? (
        <div className='flex items-center gap-2 text-sm text-slate-500'>
          <Spinner size={16} />
          Loading calls...
        </div>
      ) : calls.length === 0 ? (
        <div className='text-sm text-slate-500'>No call history found</div>
      ) : (
        <ul className='space-y-2'>
          {calls.map(call => {
            const isMissed = call.talkingTime === 0 && call.type === 'incoming'

            return (
              <li key={call.callId} className='border rounded p-3 bg-white'>
                <div className='flex items-center gap-3 text-sm'>
                  <span className={isMissed ? 'text-red-500' : 'text-slate-600'}>
                    {call.type === 'incoming' ? (
                      <PhoneIncoming size={16} />
                    ) : (
                      <PhoneOutgoing size={16} />
                    )}
                  </span>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-baseline justify-between gap-2'>
                      <span className='text-slate-800'>
                        {format(new Date(call.startedAt), 'M/d/yyyy h:mm a')}
                      </span>
                      {isMissed ? (
                        <span className='text-xs font-semibold text-red-500'>
                          Missed
                        </span>
                      ) : (
                        <span className='text-xs text-slate-500'>
                          {formatDuration(call.talkingTime)}
                        </span>
                      )}
                    </div>
                    <div className='text-xs text-slate-500'>
                      Agent: {call.agentName}
                    </div>
                  </div>

                  {call.recorded && (
                    <RecordingPlayer recordingLink={call.recordingLink} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
