import { Pencil, Pin, PinOff, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
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
import { Textarea } from '~/components/ui/textarea'
import { formatTimestamp } from '~/lib/dateHelpers'
import { buildNoteApiAction } from '~/lib/dealApiHelpers'
import { cn } from '~/lib/utils'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type { ApiResponse } from '~/utils/apiResponse.server'

export interface NoteItemHandlers {
  dealId: number
  token: string
  remove: (noteId: number) => void
  addComment: (noteId: number, content: string) => void
  editNote: (noteId: number, content: string) => void
  deletingData?: FormData
}

export function NoteItem({
  note,
  handlers,
}: {
  note: DealNote
  handlers: NoteItemHandlers
}) {
  const { dealId, token, remove, addComment, editNote, deletingData } = handlers
  const pinFetcher = useFetcher<ApiResponse>({ key: `pin-note-${note.id}` })
  const isDeleting = deletingData?.get('noteId') === String(note.id)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const commentContainerRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isPinning = pinFetcher.state !== 'idle'
  const isPinned = isPinning ? !note.is_pinned : !!note.is_pinned

  const pin = () => {
    pinFetcher.submit(
      { intent: 'pin', noteId: String(note.id), csrf: token },
      { method: 'POST', action: buildNoteApiAction(dealId) },
    )
  }

  const handleAddComment = () => {
    if (!commentText.trim()) return
    addComment(note.id, commentText.trim())
    setCommentText('')
    setShowCommentInput(false)
  }

  const startEditing = () => {
    setEditContent(note.content)
    setIsEditingNote(true)
  }

  const cancelEditing = () => {
    setIsEditingNote(false)
    setEditContent(note.content)
  }

  const saveEdit = () => {
    const trimmed = editContent.trim()
    if (!trimmed || trimmed === note.content) {
      cancelEditing()
      return
    }
    editNote(note.id, trimmed)
    setIsEditingNote(false)
  }

  const resizeEditTextarea = () => {
    const el = editTextareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (isEditingNote) {
      requestAnimationFrame(() => {
        const el = editTextareaRef.current
        if (el) {
          const end = el.value.length
          resizeEditTextarea()
          el.focus()
          el.setSelectionRange(end, end)
        }
      })
    }
  }, [isEditingNote])

  useEffect(() => {
    if (isEditingNote) {
      resizeEditTextarea()
    }
  }, [editContent, isEditingNote])

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
        'rounded-md px-3 py-2.5 transition-[opacity,transform,background-color,border-color]',
        isPinned
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-gray-50 border border-gray-200',
        isDeleting && 'opacity-0 scale-95 pointer-events-none',
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='text-[11px] text-gray-500 leading-tight'>
          {formatTimestamp(note.created_at)}
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
            className='h-6 w-6 text-gray-400 hover:text-blue-500'
            onClick={startEditing}
          >
            <Pencil className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className={cn(
              'h-6 w-6',
              isPinned
                ? 'text-amber-600 hover:text-amber-700'
                : 'text-gray-400 hover:text-amber-500',
            )}
            onClick={pin}
          >
            {isPinned ? (
              <PinOff className='h-3.5 w-3.5' />
            ) : (
              <Pin className='h-3.5 w-3.5' />
            )}
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

      {isEditingNote ? (
        <div className='mt-1 space-y-1.5'>
          <Textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className='text-sm min-h-[60px] resize-none overflow-hidden'
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                saveEdit()
              }
              if (e.key === 'Escape') {
                cancelEditing()
              }
            }}
          />
          <div className='flex gap-1.5 justify-end'>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 text-xs px-2'
              onClick={cancelEditing}
            >
              Cancel
            </Button>
            <Button
              size='sm'
              className='h-6 text-xs px-2'
              onClick={saveEdit}
              disabled={!editContent.trim() || editContent.trim() === note.content}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className='text-sm text-gray-800 whitespace-pre-wrap mt-1 leading-relaxed'>
          {note.content}
        </p>
      )}

      {note.comments.length > 0 && (
        <div className='mt-2.5 pl-3 border-l-2 border-gray-200 space-y-1.5'>
          {note.comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              dealId={dealId}
              token={token}
            />
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

function CommentItem({
  comment,
  dealId,
  token,
}: {
  comment: DealNote['comments'][number]
  dealId: number
  token: string
}) {
  const fetcher = useFetcher<ApiResponse>({
    key: `delete-comment-${comment.id}`,
  })
  const isDeleting = fetcher.state !== 'idle'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = () => {
    fetcher.submit(
      {
        intent: 'delete-comment',
        commentId: String(comment.id),
        csrf: token,
      },
      { method: 'POST', action: buildNoteApiAction(dealId) },
    )
  }

  return (
    <div
      className={cn(
        'group flex items-start justify-between gap-1',
        isDeleting && 'hidden',
      )}
    >
      <div className='min-w-0'>
        <span className='text-[10px] text-gray-400'>
          {formatTimestamp(comment.created_at)}
          {comment.created_by && ` · ${comment.created_by}`}
        </span>
        <p className='text-xs text-gray-600 leading-relaxed'>{comment.content}</p>
      </div>
      <button
        type='button'
        className='opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0 mt-0.5 text-gray-400 hover:text-red-500 transition-opacity'
        onClick={() => setShowDeleteConfirm(true)}
      >
        <X className='h-3 w-3' />
      </button>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
