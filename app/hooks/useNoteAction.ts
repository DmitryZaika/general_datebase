import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { buildNoteApiAction } from '~/lib/dealApiHelpers'
import type { ApiResponse } from '~/utils/apiResponse.server'
import { useToast } from './use-toast'

export function useNoteAction(dealId: number) {
  const deleteFetcher = useFetcher<ApiResponse>()
  const commentFetcher = useFetcher<ApiResponse>()
  const editFetcher = useFetcher<ApiResponse>()
  const { toast } = useToast()
  const token = useAuthenticityToken()

  const deleteSubmitted = useRef(false)
  const commentSubmitted = useRef(false)
  const editSubmitted = useRef(false)

  useEffect(() => {
    if (
      !deleteSubmitted.current ||
      deleteFetcher.state !== 'idle' ||
      !deleteFetcher.data
    )
      return
    deleteSubmitted.current = false
    if (deleteFetcher.data.success) {
      toast({
        title: 'Note deleted',
        description: 'Note has been removed',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Failed to delete note',
        description: deleteFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [deleteFetcher.state, deleteFetcher.data, toast])

  useEffect(() => {
    if (
      !commentSubmitted.current ||
      commentFetcher.state !== 'idle' ||
      !commentFetcher.data
    )
      return
    commentSubmitted.current = false
    if (commentFetcher.data.success) {
      toast({
        title: 'Comment added',
        description: 'Your comment has been added',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Failed to add comment',
        description: commentFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [commentFetcher.state, commentFetcher.data, toast])

  useEffect(() => {
    if (!editSubmitted.current || editFetcher.state !== 'idle' || !editFetcher.data)
      return
    editSubmitted.current = false
    if (editFetcher.data.success) {
      toast({
        title: 'Note updated',
        description: 'Note has been updated',
        variant: 'success',
      })
    } else {
      toast({
        title: 'Failed to update note',
        description: editFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [editFetcher.state, editFetcher.data, toast])

  const remove = useCallback(
    (noteId: number) => {
      deleteSubmitted.current = true
      deleteFetcher.submit(
        { intent: 'delete', noteId: String(noteId), csrf: token },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    },
    [deleteFetcher.submit, dealId, token],
  )

  const addComment = useCallback(
    (noteId: number, content: string) => {
      commentSubmitted.current = true
      commentFetcher.submit(
        { intent: 'add-comment', noteId: String(noteId), content, csrf: token },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    },
    [commentFetcher.submit, dealId, token],
  )

  const editNote = useCallback(
    (noteId: number, content: string) => {
      editSubmitted.current = true
      editFetcher.submit(
        { intent: 'update', noteId: String(noteId), content, csrf: token },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    },
    [editFetcher.submit, dealId, token],
  )

  return {
    dealId,
    token,
    remove,
    addComment,
    editNote,
    isCommenting: commentFetcher.state !== 'idle',
    isEditing: editFetcher.state !== 'idle',
    deletingData: deleteFetcher.formData,
  }
}
