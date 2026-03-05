import { useCallback, useEffect, useRef } from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { buildNoteApiAction } from '~/lib/dealApiHelpers'
import type { ApiResponse } from '~/utils/apiResponse.server'
import { useToast } from './use-toast'

export function useNoteAction(dealId: number) {
  const pinFetcher = useFetcher<ApiResponse>()
  const deleteFetcher = useFetcher<ApiResponse>()
  const commentFetcher = useFetcher<ApiResponse>()
  const revalidator = useRevalidator()
  const { toast } = useToast()
  const token = useAuthenticityToken()

  const pinSubmitted = useRef(false)
  const deleteSubmitted = useRef(false)
  const commentSubmitted = useRef(false)

  useEffect(() => {
    if (
      (pinSubmitted.current && pinFetcher.state === 'idle' && pinFetcher.data) ||
      (deleteSubmitted.current && deleteFetcher.state === 'idle' && deleteFetcher.data) ||
      (commentSubmitted.current && commentFetcher.state === 'idle' && commentFetcher.data)
    ) {
      revalidator.revalidate()
    }
  }, [
    pinFetcher.state,
    pinFetcher.data,
    deleteFetcher.state,
    deleteFetcher.data,
    commentFetcher.state,
    commentFetcher.data,
    revalidator,
  ])

  useEffect(() => {
    if (!deleteSubmitted.current || deleteFetcher.state !== 'idle' || !deleteFetcher.data) return
    if (deleteFetcher.data.success) {
      toast({ title: 'Note deleted', description: 'Note has been removed', variant: 'success' })
    } else {
      toast({
        title: 'Failed to delete note',
        description: deleteFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [deleteFetcher.state, deleteFetcher.data, toast])

  useEffect(() => {
    if (!commentSubmitted.current || commentFetcher.state !== 'idle' || !commentFetcher.data) return
    if (commentFetcher.data.success) {
      toast({ title: 'Comment added', description: 'Your comment has been added', variant: 'success' })
    } else {
      toast({
        title: 'Failed to add comment',
        description: commentFetcher.data.error ?? 'Something went wrong',
        variant: 'destructive',
      })
    }
  }, [commentFetcher.state, commentFetcher.data, toast])

  const pin = useCallback(
    (noteId: number) => {
      pinSubmitted.current = true
      pinFetcher.submit(
        { intent: 'pin', noteId: String(noteId), csrf: token },
        { method: 'POST', action: buildNoteApiAction(dealId) },
      )
    },
    [pinFetcher.submit, dealId, token],
  )

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

  return {
    pin,
    remove,
    addComment,
    isPinning: pinFetcher.state !== 'idle',
    isCommenting: commentFetcher.state !== 'idle',
    pinningData: pinFetcher.formData,
    deletingData: deleteFetcher.formData,
  }
}
