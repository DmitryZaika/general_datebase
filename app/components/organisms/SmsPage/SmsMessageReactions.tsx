import { SmilePlus } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { SmsEmojiPicker } from './SmsEmojiPicker'
import { SMS_QUICK_REACTIONS } from './smsQuickReactions'

export interface SmsMessageReactionsProps {
  onPick: (emoji: string) => void
  disabled?: boolean
}

export function SmsMessageReactions(props: SmsMessageReactionsProps) {
  const [open, setOpen] = useState(false)

  function pick(emoji: string) {
    props.onPick(emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label='React to message'
          disabled={props.disabled}
          className='inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-100 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
        >
          <SmilePlus size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align='start' side='top' className='w-auto p-2'>
        <div className='text-[10px] font-medium uppercase tracking-wide text-slate-400 px-1 pb-1.5'>
          React
        </div>
        <div className='grid grid-cols-6 gap-0.5'>
          {SMS_QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type='button'
              onClick={() => pick(emoji)}
              className='h-9 w-9 flex items-center justify-center text-xl rounded-md hover:bg-slate-100 transition-colors'
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className='mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 px-1'>
          <span className='text-[11px] text-slate-500'>More emotions</span>
          <SmsEmojiPicker disabled={props.disabled} onPick={pick} closeOnPick />
        </div>
      </PopoverContent>
    </Popover>
  )
}
