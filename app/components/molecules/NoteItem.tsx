import { format } from 'date-fns'
import { Pin, PinOff, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'

export interface NoteItemHandlers {
  pin: (noteId: number) => void
  remove: (noteId: number) => void
  addComment: (noteId: number, content: string) => void
  pinningData?: FormData
  deletingData?: FormData
}

export function NoteItem({ note, handlers }: { note: DealNote; handlers: NoteItemHandlers }) {
  const { pin, remove, addComment, pinningData, deletingData } = handlers
  const isDeleting = deletingData?.get('noteId') === String(note.id)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const commentInputRef = useRef<HTMLInputElement>(null)
  const commentContainerRef = useRef<HTMLDivElement>(null)

  const isPinned =
    pinningData?.get('noteId') === String(note.id) ? !note.is_pinned : !!note.is_pinned

  const handleAddComment = () => {
    if (!commentText.trim()) return
    addComment(note.id, commentText.trim())
    setCommentText('')
    setShowCommentInput(false)
  }

  useEffect(() => {
    if (showCommentInput) {
      requestAnimationFrame(() => commentInputRef.current?.focus())
    }
  }, [showCommentInput])

  useEffect(() => {
    if (!showCommentInput) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        commentContainerRef.current &&
        !commentContainerRef.current.contains(e.target as Node)
      ) {
        setShowCommentInput(false)
        setCommentText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCommentInput])

  return (
    <div
      className={cn(
        'rounded-md px-3 py-2.5 transition-all',
        isPinned ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200',
        isDeleting && 'opacity-0 scale-95 pointer-events-none',
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='text-[11px] text-gray-500 leading-tight'>
          {format(new Date(note.created_at), 'MMMM d h:mm a')}
          {note.created_by && <> &middot; {note.created_by}</>}
        </span>

        <div className='flex items-center gap-1 shrink-0'>
          {!showCommentInput && (
            <button
              type='button'
              className='text-[11px] text-blue-500 hover:text-blue-700 px-1 whitespace-nowrap'
              onClick={() => setShowCommentInput(true)}
            >
              Add a comment
            </button>
          )}
          <Button
            variant='ghost'
            size='icon'
            className={cn(
              'h-6 w-6',
              isPinned
                ? 'text-amber-600 hover:text-amber-700'
                : 'text-gray-400 hover:text-amber-500',
            )}
            onClick={() => pin(note.id)}
          >
            {isPinned ? <PinOff className='h-3.5 w-3.5' /> : <Pin className='h-3.5 w-3.5' />}
          </Button>

          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6 shrink-0 text-gray-600 hover:text-red-500'
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        </div>
      </div>

      <p className='text-sm text-gray-800 whitespace-pre-wrap mt-1 leading-relaxed'>
        {note.content}
      </p>

      {note.comments.length > 0 && (
        <div className='mt-2.5 pl-3 border-l-2 border-gray-200 space-y-1.5'>
          {note.comments.map(comment => (
            <div key={comment.id}>
              <span className='text-[10px] text-gray-400'>
                {format(new Date(comment.created_at), 'MMM d h:mm a')}
                {comment.created_by && ` \u00b7 ${comment.created_by}`}
              </span>
              <p className='text-xs text-gray-600 leading-relaxed'>{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {showCommentInput && (
        <div ref={commentContainerRef} className='mt-2 flex gap-1.5'>
          <Input
            ref={commentInputRef}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder='Write a comment...'
            className='h-7 text-xs flex-1'
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddComment()
              }
              if (e.key === 'Escape') {
                setShowCommentInput(false)
                setCommentText('')
              }
            }}
          />
          <Button
            size='sm'
            className='h-7 text-xs px-2.5'
            onClick={handleAddComment}
            disabled={!commentText.trim()}
          >
            Add
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => remove(note.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
