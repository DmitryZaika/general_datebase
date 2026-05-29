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
import { buildActivityApiAction, buildNoteApiAction } from '~/lib/dealApiHelpers'
import { cn } from '~/lib/utils'
import { ActivityPriority } from '~/routes/api.deal-activities.$dealId'
import type { ApiResponse } from '~/utils/apiResponse.server'

type CallTranscriptionOptions = {
  callId: number
  recordingLink: string
  dealId?: number
  callStartedAt?: string
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

function useCallTranscriptionLogic({
  callId,
  recordingLink,
  dealId,
  callStartedAt,
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
  const activitySubmitted = useRef(false)

  const noteFetcher = useFetcher<ApiResponse>()
  const activityFetcher = useFetcher<ApiResponse>()
  const revalidator = useRevalidator()
  const token = useAuthenticityToken()
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
    if (
      !activitySubmitted.current ||
      activityFetcher.state !== 'idle' ||
      !activityFetcher.data
    )
      return
    activitySubmitted.current = false
    setActivityLoading(false)

    if (activityFetcher.data.success) {
      setActivityCreated(true)
      setVisible(false)
      revalidator.revalidate()
      toast({
        title: 'Activity added',
        description: 'Follow-up action saved to the deal',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Failed to add activity',
        description: activityFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [activityFetcher.state, activityFetcher.data, revalidator, toast])

  const fetchTranscript = useCallback(
    async (showText: boolean): Promise<string> => {
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

      setText(transcript)
      if (showText) {
        setVisible(true)
      }
      return transcript
    },
    [callId, recordingLink],
  )

  const ensureTranscript = useCallback(async (): Promise<string> => {
    if (text) return text
    setLoading(true)
    setError(null)
    try {
      return await fetchTranscript(false)
    } finally {
      setLoading(false)
    }
  }, [text, fetchTranscript])

  const handleTranscribe = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
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
      const response = await fetch('/api/aiSummarize/callNote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      const json: { content?: string; error?: string } = await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Failed to summarize call')
      }

      const content = json.content?.trim()
      if (!content) {
        throw new Error('No note content returned')
      }

      noteSubmitted.current = true
      noteFetcher.submit(
        { intent: 'create', content, csrf: token },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    } catch (err) {
      setNoteLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to add note')
    }
  }, [dealId, noteLoading, noteCreated, ensureTranscript, noteFetcher, token])

  const handleCreateActivity = useCallback(async () => {
    if (!dealId || activityLoading || activityCreated || activitySubmitted.current)
      return

    setActivityLoading(true)
    setError(null)
    setVisible(false)

    try {
      const transcript = await ensureTranscript()
      const response = await fetch('/api/aiSummarize/callActivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          callStartedAt,
        }),
      })

      const json: { name?: string; deadline?: string | null; error?: string } =
        await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Failed to extract activity')
      }

      const name = json.name?.trim() || 'Follow-up'

      const payload: Record<string, string> = {
        intent: 'create',
        name,
        priority: ActivityPriority.Medium,
        csrf: token,
      }

      if (json.deadline?.trim()) {
        payload.deadline = json.deadline.trim()
      }

      activitySubmitted.current = true
      activityFetcher.submit(payload, {
        method: 'POST',
        action: buildActivityApiAction(dealId),
      })
    } catch (err) {
      setActivityLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to add activity')
    }
  }, [
    dealId,
    activityLoading,
    activityCreated,
    ensureTranscript,
    callStartedAt,
    activityFetcher,
    token,
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
  children,
}: CallTranscriptionOptions & { children: ReactNode }) {
  const value = useCallTranscriptionLogic({
    callId,
    recordingLink,
    dealId,
    callStartedAt,
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
        >
          <span className='sr-only'>Call actions</span>
          <MoreVertical className='h-3.5 w-3.5' />
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
  const { visible, text } = useCallTranscriptionContext()

  if (!visible || !text) return null

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
  showRecording,
  onToggleRecording,
  buttonClassName,
  textClassName,
}: CallTranscriptionProps) {
  return (
    <CallTranscriptionProvider
      callId={callId}
      recordingLink={recordingLink}
      dealId={dealId}
      callStartedAt={callStartedAt}
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
