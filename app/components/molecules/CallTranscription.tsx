import { Loader2, MoreVertical } from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { Button } from '~/components/ui/button'
import { useToast } from '~/hooks/use-toast'
import {
  isVoicemailGreetingOnly,
  resolveIsVoicemail,
  sanitizeCallNoteContent,
  VOICEMAIL_GREETING_ACTIVITY_NAME,
} from '~/lib/callAiHelpers'
import { buildActivityApiAction, buildNoteApiAction } from '~/lib/dealApiHelpers'
import { cn } from '~/lib/utils'
import { ActivityPriority } from '~/routes/api.deal-activities.$dealId'
import type { ApiResponse } from '~/utils/apiResponse.server'

type CallTranscriptionOptions = {
  callId: number
  recordingLink: string
  dealId?: number
  callStartedAt?: string
  isVoicemail?: boolean
}

type CallTranscriptionContextValue = {
  loading: boolean
  text: string | null
  visible: boolean
  error: string | null
  noteLoading: boolean
  noteCreated: boolean
  activityLoading: boolean
  activityCreated: boolean
  ensureTranscript: () => Promise<string>
  handleToggleText: () => void
  handleTranscribe: () => Promise<void>
  handleCreateNote: () => Promise<void>
  handleCreateActivity: () => Promise<void>
}

const CallTranscriptionContext = createContext<CallTranscriptionContextValue | null>(
  null,
)

function useCallTranscriptionContext(): CallTranscriptionContextValue {
  const context = useContext(CallTranscriptionContext)
  if (!context) {
    throw new Error(
      'CallTranscription components must be used within CallTranscriptionProvider',
    )
  }
  return context
}

const VOICEMAIL_FOLLOW_UP_ACTIVITY = 'Follow-up to confirm interest'

const callTranscriptSessionCache = new Map<number, string>()

function useCallTranscriptionLogic({
  callId,
  recordingLink,
  dealId,
  callStartedAt,
  isVoicemail = false,
}: CallTranscriptionOptions): CallTranscriptionContextValue {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteCreated, setNoteCreated] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityCreated, setActivityCreated] = useState(false)
  const noteSubmitted = useRef(false)
  const transcribeRequestRef = useRef<Promise<string> | null>(null)
  const activeCallIdRef = useRef(callId)

  const noteFetcher = useFetcher<ApiResponse>()
  const revalidator = useRevalidator()
  const token = useAuthenticityToken()
  const csrfTokenRef = useRef(token)
  csrfTokenRef.current = token
  const { toast } = useToast()

  useEffect(() => {
    if (!noteSubmitted.current || noteFetcher.state !== 'idle' || !noteFetcher.data)
      return
    noteSubmitted.current = false
    setNoteLoading(false)

    if (noteFetcher.data.success) {
      setNoteCreated(true)
      setVisible(false)
      revalidator.revalidate()
      toast({
        title: 'Note added',
        description: 'Call summary saved as a note',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Failed to add note',
        description: noteFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [noteFetcher.state, noteFetcher.data, revalidator, toast])

  useEffect(() => {
    activeCallIdRef.current = callId
    setLoading(false)
    setText(callTranscriptSessionCache.get(callId) ?? null)
    setVisible(false)
    setError(null)
    setNoteLoading(false)
    setNoteCreated(false)
    setActivityLoading(false)
    setActivityCreated(false)
    noteSubmitted.current = false
    transcribeRequestRef.current = null
  }, [callId, recordingLink])

  const isActiveCall = useCallback(() => activeCallIdRef.current === callId, [callId])

  const applyTranscript = useCallback(
    (transcript: string, showText: boolean) => {
      const trimmed = transcript.trim()
      callTranscriptSessionCache.set(callId, trimmed)
      setText(trimmed)
      if (showText) {
        setVisible(true)
      }
      return trimmed
    },
    [callId],
  )

  const fetchTranscript = useCallback(
    async (showText: boolean): Promise<string> => {
      const cached = callTranscriptSessionCache.get(callId)
      if (cached) {
        return applyTranscript(cached, showText)
      }

      if (transcribeRequestRef.current) {
        if (showText) {
          setLoading(true)
          setError(null)
        }
        try {
          return await transcribeRequestRef.current
        } finally {
          if (showText) {
            setLoading(false)
          }
        }
      }

      if (showText) {
        setLoading(true)
        setError(null)
      }

      const request = (async () => {
        const response = await fetch(`/api/aiTranscribe/call/${callId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordingLink }),
        })

        const json: { text?: string; error?: string } = await response.json()
        if (!response.ok) {
          throw new Error(json.error ?? 'Failed to transcribe call')
        }

        const transcript = json.text?.trim()
        if (!transcript) {
          throw new Error('No transcription returned')
        }

        return applyTranscript(transcript, showText)
      })()

      transcribeRequestRef.current = request

      try {
        return await request
      } finally {
        transcribeRequestRef.current = null
        if (showText) {
          setLoading(false)
        }
      }
    },
    [callId, recordingLink, applyTranscript],
  )

  const ensureTranscript = useCallback(async (): Promise<string> => {
    if (text) return text
    try {
      return await fetchTranscript(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe call')
      throw err
    }
  }, [text, fetchTranscript])

  const handleTranscribe = useCallback(async () => {
    if (loading) return
    setVisible(true)
    setError(null)
    setLoading(true)
    try {
      await fetchTranscript(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe call')
    } finally {
      setLoading(false)
    }
  }, [loading, fetchTranscript])

  const handleToggleText = useCallback(() => {
    if (text) {
      setVisible(value => !value)
      return
    }
    void handleTranscribe()
  }, [text, handleTranscribe])

  const handleCreateNote = useCallback(async () => {
    if (!dealId || noteLoading || noteCreated || noteSubmitted.current) return

    setNoteLoading(true)
    setError(null)
    setVisible(false)

    try {
      const transcript = await ensureTranscript()
      const voicemail = resolveIsVoicemail(isVoicemail, transcript)
      const response = await fetch('/api/aiSummarize/callNote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, isVoicemail: voicemail }),
      })

      const json: { content?: string; error?: string } = await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Failed to summarize call')
      }

      const summarized = json.content?.trim()
      if (!summarized) {
        throw new Error('No note content returned')
      }

      const content = sanitizeCallNoteContent(summarized, voicemail, transcript)
      noteSubmitted.current = true
      noteFetcher.submit(
        { intent: 'create', content, csrf: csrfTokenRef.current },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    } catch (err) {
      setNoteLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to add note')
    }
  }, [dealId, noteLoading, noteCreated, ensureTranscript, noteFetcher, isVoicemail])

  const handleCreateActivity = useCallback(async () => {
    if (!dealId || activityLoading || activityCreated) return

    const requestCallId = callId
    setActivityLoading(true)
    setError(null)
    setVisible(false)

    try {
      const transcript = await ensureTranscript()
      if (!isActiveCall() || requestCallId !== callId) return
      const voicemail = resolveIsVoicemail(isVoicemail, transcript)
      const response = await fetch('/api/aiSummarize/callActivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          callStartedAt,
          committedAt: new Date().toISOString(),
          isVoicemail: voicemail,
        }),
      })

      const json: {
        activities?: Array<{ name?: string; deadline?: string | null }>
        name?: string
        deadline?: string | null
        error?: string
      } = await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Failed to extract activity')
      }
      if (!isActiveCall() || requestCallId !== callId) return

      const extracted: Array<{ name: string; deadline: string | null }> = []

      if (json.activities && json.activities.length > 0) {
        for (const item of json.activities) {
          const name = item.name?.trim()
          if (!name) continue
          extracted.push({
            name,
            deadline: item.deadline?.trim() || null,
          })
        }
      } else {
        const name = json.name?.trim()
        if (name) {
          extracted.push({
            name,
            deadline: json.deadline?.trim() || null,
          })
        }
      }

      if (extracted.length === 0) {
        const fallbackName = voicemail
          ? isVoicemailGreetingOnly(transcript)
            ? VOICEMAIL_GREETING_ACTIVITY_NAME
            : VOICEMAIL_FOLLOW_UP_ACTIVITY
          : 'Follow-up'
        extracted.push({ name: fallbackName, deadline: null })
      }

      for (const activity of extracted) {
        const formData = new FormData()
        formData.append('intent', 'create')
        formData.append('name', activity.name)
        formData.append('priority', ActivityPriority.Medium)
        formData.append('csrf', csrfTokenRef.current)
        if (activity.deadline) {
          formData.append('deadline', activity.deadline)
        }

        const createResponse = await fetch(buildActivityApiAction(dealId), {
          method: 'POST',
          body: formData,
        })

        const createJson: ApiResponse = await createResponse.json()
        if (!createResponse.ok || !createJson.success) {
          throw new Error(
            createJson.success === false ? createJson.error : 'Failed to add activity',
          )
        }
      }

      if (!isActiveCall() || requestCallId !== callId) return

      setActivityCreated(true)
      setVisible(false)
      revalidator.revalidate()
      toast({
        title: extracted.length > 1 ? 'Activities added' : 'Activity added',
        description:
          extracted.length > 1
            ? `${extracted.length} follow-up tasks saved to the deal`
            : 'Follow-up action saved to the deal',
        variant: 'success',
      })
    } catch (err) {
      if (!isActiveCall() || requestCallId !== callId) return
      setError(err instanceof Error ? err.message : 'Failed to add activity')
    } finally {
      if (isActiveCall() && requestCallId === callId) {
        setActivityLoading(false)
      }
    }
  }, [
    dealId,
    callId,
    activityLoading,
    activityCreated,
    ensureTranscript,
    callStartedAt,
    isVoicemail,
    isActiveCall,
    revalidator,
    toast,
  ])

  return {
    loading,
    text,
    visible,
    error,
    noteLoading,
    noteCreated,
    activityLoading,
    activityCreated,
    ensureTranscript,
    handleToggleText,
    handleTranscribe,
    handleCreateNote,
    handleCreateActivity,
  }
}

export function CallTranscriptionProvider({
  callId,
  recordingLink,
  dealId,
  callStartedAt,
  isVoicemail,
  children,
}: CallTranscriptionOptions & { children: ReactNode }) {
  const value = useCallTranscriptionLogic({
    callId,
    recordingLink,
    dealId,
    callStartedAt,
    isVoicemail,
  })

  return (
    <CallTranscriptionContext.Provider value={value}>
      {children}
    </CallTranscriptionContext.Provider>
  )
}

function compactButtonClassName(extra?: string) {
  return cn(
    'h-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60',
    extra,
  )
}

export function CallTranscriptionPrimaryButtons({
  buttonClassName,
}: {
  buttonClassName?: string
}) {
  const {
    noteLoading,
    noteCreated,
    activityLoading,
    activityCreated,
    handleCreateNote,
    handleCreateActivity,
  } = useCallTranscriptionContext()

  return (
    <div className='flex items-center gap-1'>
      <Button
        type='button'
        variant='ghost'
        className={compactButtonClassName(buttonClassName)}
        onClick={() => void handleCreateNote()}
        disabled={noteLoading || noteCreated}
      >
        <span className='inline-flex items-center gap-1'>
          {noteLoading ? (
            <Loader2 className='h-3 w-3 animate-spin' aria-hidden />
          ) : null}
          {noteCreated ? 'Note added' : 'Add note'}
        </span>
      </Button>
      <Button
        type='button'
        variant='ghost'
        className={compactButtonClassName(buttonClassName)}
        onClick={() => void handleCreateActivity()}
        disabled={activityLoading || activityCreated}
      >
        <span className='inline-flex items-center gap-1'>
          {activityLoading ? (
            <Loader2 className='h-3 w-3 animate-spin' aria-hidden />
          ) : null}
          {activityCreated ? 'Activity added' : 'Add Activity'}
        </span>
      </Button>
    </div>
  )
}

export function CallTranscriptionMenu({
  showRecording,
  onToggleRecording,
  buttonClassName,
  includePrimaryActions = false,
}: {
  showRecording: boolean
  onToggleRecording: () => void
  buttonClassName?: string
  includePrimaryActions?: boolean
}) {
  const {
    loading,
    text,
    visible,
    handleToggleText,
    handleTranscribe,
    noteLoading,
    noteCreated,
    activityLoading,
    activityCreated,
    handleCreateNote,
    handleCreateActivity,
  } = useCallTranscriptionContext()

  const transcriptLabel = loading
    ? 'Transcribing…'
    : text
      ? visible
        ? 'Hide text'
        : 'Show text'
      : 'Transcribe'

  const primaryActionOptions = includePrimaryActions
    ? [
        {
          label: noteLoading ? 'Adding note…' : noteCreated ? 'Note added' : 'Add note',
          disabled: noteLoading || noteCreated,
          className: 'md:hidden',
          onClick: () => void handleCreateNote(),
        },
        {
          label: activityLoading
            ? 'Adding activity…'
            : activityCreated
              ? 'Activity added'
              : 'Add Activity',
          disabled: activityLoading || activityCreated,
          className: 'md:hidden',
          onClick: () => void handleCreateActivity(),
        },
      ]
    : []

  return (
    <CustomDropdownMenu
      align='end'
      trigger={
        <Button
          type='button'
          variant='ghost'
          className={cn('h-6 w-6 p-0', buttonClassName)}
          disabled={loading}
        >
          <span className='sr-only'>Call actions</span>
          <MoreVertical className='h-3.5 w-3.5' aria-hidden />
        </Button>
      }
      options={[
        ...primaryActionOptions,
        {
          label: showRecording ? 'Hide voice call' : 'Voice call',
          onClick: onToggleRecording,
        },
        {
          label: transcriptLabel,
          disabled: loading,
          onClick: () => {
            if (text) {
              handleToggleText()
              return
            }
            void handleTranscribe()
          },
        },
      ]}
    />
  )
}

export function CallTranscriptionText({ textClassName }: { textClassName?: string }) {
  const { visible, text, loading } = useCallTranscriptionContext()

  if (!visible) return null

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs text-slate-500',
          textClassName,
        )}
      >
        <Loader2 className='h-3 w-3 shrink-0 animate-spin' aria-hidden />
        <span>Transcribing…</span>
      </div>
    )
  }

  if (!text) return null

  return (
    <p
      className={cn(
        'text-xs text-slate-600 whitespace-pre-wrap break-words',
        textClassName,
      )}
    >
      {text}
    </p>
  )
}

export function CallTranscriptionError() {
  const { error } = useCallTranscriptionContext()

  if (!error) return null

  return <p className='text-[10px] text-red-500 break-words'>{error}</p>
}

type CallTranscriptionProps = CallTranscriptionOptions & {
  showRecording: boolean
  onToggleRecording: () => void
  buttonClassName?: string
  textClassName?: string
}

export function CallTranscription({
  callId,
  recordingLink,
  dealId,
  callStartedAt,
  isVoicemail,
  showRecording,
  onToggleRecording,
  buttonClassName,
  textClassName,
}: CallTranscriptionProps) {
  return (
    <CallTranscriptionProvider
      key={callId}
      callId={callId}
      recordingLink={recordingLink}
      dealId={dealId}
      callStartedAt={callStartedAt}
      isVoicemail={isVoicemail}
    >
      <div className='flex flex-col gap-1'>
        <div className='flex items-center justify-end gap-1'>
          {dealId ? (
            <div className='hidden md:flex'>
              <CallTranscriptionPrimaryButtons buttonClassName={buttonClassName} />
            </div>
          ) : null}
          <CallTranscriptionMenu
            showRecording={showRecording}
            onToggleRecording={onToggleRecording}
            buttonClassName={buttonClassName}
            includePrimaryActions={!!dealId}
          />
        </div>
        <CallTranscriptionError />
        <CallTranscriptionText textClassName={textClassName} />
      </div>
    </CallTranscriptionProvider>
  )
}
