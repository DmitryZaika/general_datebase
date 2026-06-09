import { SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Textarea } from '~/components/ui/textarea'
import { cn } from '~/lib/utils'
import { SMS_MAX_TEXT, SMS_SEGMENT_LEN } from '~/utils/phone'
import { SmsEmojiPicker } from './SmsEmojiPicker'

export interface SmsComposerProps {
  phoneDigits: string
  canSend: boolean
  readOnly?: boolean
  isSending: boolean
  onSubmit: (text: string) => void
}

const MIN_HEIGHT = 40 // ~1 line, matches the Send button height
const MAX_HEIGHT = 180

export function SmsComposer(props: SmsComposerProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = '0px'
    const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight))
    el.style.height = `${next}px`
  }, [])

  useEffect(() => {
    if (textareaRef.current) resizeTextarea(textareaRef.current)
  }, [resizeTextarea])

  useEffect(() => {
    if (props.readOnly || !props.canSend) return
    const id = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [props.phoneDigits, props.canSend, props.readOnly])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
      resizeTextarea(e.target)
    },
    [resizeTextarea],
  )

  const handleEmojiPick = useCallback(
    (emoji: string) => {
      const el = textareaRef.current
      if (!el) {
        setText(prev => prev + emoji)
        return
      }
      const start = el.selectionStart ?? text.length
      const end = el.selectionEnd ?? text.length
      const next = text.slice(0, start) + emoji + text.slice(end)
      setText(next)
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        const caret = start + emoji.length
        textareaRef.current.value = next
        textareaRef.current.setSelectionRange(caret, caret)
        textareaRef.current.focus()
        resizeTextarea(textareaRef.current)
      })
    },
    [text, resizeTextarea],
  )

  const isOver = text.length > SMS_MAX_TEXT
  const isDisabled = props.isSending || isOver || text.trim().length === 0

  const counterVisible = text.length > 0
  const counterColor =
    text.length > SMS_MAX_TEXT
      ? 'text-red-500'
      : text.length > SMS_SEGMENT_LEN
        ? 'text-amber-500'
        : 'text-slate-400'

  const submitForm = useCallback(() => {
    if (isDisabled) return
    props.onSubmit(text)
    setText('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`
        textareaRef.current.focus()
      }
    })
  }, [isDisabled, props, text])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitForm()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submitForm()
    }
  }

  if (props.readOnly) {
    return (
      <div className='border-t border-slate-200 bg-white px-4 py-3'>
        <p className='text-center text-xs leading-snug text-slate-400'>
          View only — use employee CloudTalk SMS to reply
        </p>
      </div>
    )
  }

  if (!props.canSend) {
    return (
      <div className='border-t border-slate-200 bg-white'>
        <p className='text-center text-xs leading-snug text-slate-400'>
          Sending disabled — no CloudTalk agent linked
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='border-t border-slate-200 bg-white pb-3 px-3'
    >
      {/* Always-rendered row reserves space so the textarea doesn't shift up/down
       *  as the counter appears/disappears. */}
      <div
        className={cn('flex items-center justify-end mb-1 text-xs', counterColor)}
        aria-hidden={!counterVisible}
      >
        {counterVisible && (
          <span>
            {text.length} / {SMS_MAX_TEXT}
          </span>
        )}
      </div>
      <div className='flex items-end gap-1.5'>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder='Type a reply…'
          rows={1}
          className='flex-1 resize-none text-sm overflow-y-auto'
          style={{
            minHeight: `${MIN_HEIGHT}px`,
            maxHeight: `${MAX_HEIGHT}px`,
          }}
        />
        <SmsEmojiPicker onPick={handleEmojiPick} />
        <AiImproveButton
          getText={() => text}
          setText={value => {
            setText(value)
            requestAnimationFrame(() => {
              if (textareaRef.current) resizeTextarea(textareaRef.current)
            })
          }}
          buttonSize='icon'
          iconClassName='text-lg'
        />
        <LoadingButton type='submit' loading={props.isSending} disabled={isDisabled}>
          <SendIcon /> Send
        </LoadingButton>
      </div>
    </form>
  )
}
