import { Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Textarea } from '~/components/ui/textarea'
import { cn } from '~/lib/utils'
import { SmsEmojiPicker } from './SmsEmojiPicker'

export interface SmsComposerProps {
  phoneDigits: string
  canSend: boolean
  isSending: boolean
  onSubmit: (text: string) => void
}

const MAX_TEXT = 1600
const SEGMENT_LEN = 160
const MIN_HEIGHT = 44 // ~1 line, matches the Send button height
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

  const isOver = text.length > MAX_TEXT
  const isDisabled =
    !props.canSend || props.isSending || isOver || text.trim().length === 0

  const counterVisible = text.length > 0
  const counterColor =
    text.length > MAX_TEXT
      ? 'text-red-500'
      : text.length > SEGMENT_LEN
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

  return (
    <form onSubmit={handleSubmit} className='border-t border-slate-200 bg-white p-3'>
      {/* Always-rendered row reserves space so the textarea doesn't shift up/down
       *  as the counter appears/disappears. */}
      <div
        className={cn(
          'flex items-center justify-end mb-1.5 h-[14px] text-[11px]',
          counterColor,
        )}
        aria-hidden={!counterVisible}
      >
        {counterVisible && (
          <span>
            {text.length} / {MAX_TEXT}
          </span>
        )}
      </div>
      <div className='flex items-end gap-1.5'>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            props.canSend
              ? 'Type a reply…'
              : 'Sending disabled — no CloudTalk agent linked'
          }
          disabled={!props.canSend}
          rows={1}
          className='flex-1 resize-none text-sm overflow-y-auto py-2.5'
          style={{
            minHeight: `${MIN_HEIGHT}px`,
            maxHeight: `${MAX_HEIGHT}px`,
          }}
        />
        <SmsEmojiPicker onPick={handleEmojiPick} disabled={!props.canSend} />
        <LoadingButton
          type='submit'
          loading={props.isSending}
          disabled={isDisabled}
          className='shrink-0 h-11'
        >
          <Send size={14} className='mr-1' /> Send
        </LoadingButton>
      </div>
    </form>
  )
}
