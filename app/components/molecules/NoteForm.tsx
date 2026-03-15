import { CirclePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useToast } from '~/hooks/use-toast'
import { buildNoteApiAction } from '~/lib/dealApiHelpers'
import type { ApiResponse } from '~/utils/apiResponse.server'

export function NoteForm({ dealId, onNoteCreated }: { dealId: number; onNoteCreated?: () => void }) {
  const fetcher = useFetcher<ApiResponse>()
  const revalidator = useRevalidator()
  const token = useAuthenticityToken()
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const hasSubmitted = useRef(false)
  const isSubmitting = fetcher.state !== 'idle'
  const isValid = content.trim().length > 0

  useEffect(() => {
    if (!hasSubmitted.current || fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data.success) {
      hasSubmitted.current = false
      setContent('')
      revalidator.revalidate()
      onNoteCreated?.()
    } else {
      toast({
        title: 'Failed to add note',
        description: fetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [fetcher.state, fetcher.data, revalidator, toast, onNoteCreated])

  const handleSubmit = () => {
    if (!isValid) return
    hasSubmitted.current = true
    fetcher.submit(
      { intent: 'create', content: content.trim(), csrf: token },
      { method: 'POST', action: buildNoteApiAction(dealId) },
    )
  }

  return (
    <div className='space-y-2 mb-4'>
      <Textarea
        placeholder='Write a note...'
        value={content}
        onChange={e => setContent(e.target.value)}
        disabled={isSubmitting}
        className='text-sm min-h-[80px] resize-none'
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <Button
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        size='sm'
        className='w-full h-9 text-sm'
      >
        <CirclePlus className='mr-1.5 h-3.5 w-3.5' />
        {isSubmitting ? 'Adding...' : 'Add Note'}
      </Button>
    </div>
  )
}
