import { useCallback, useRef, useState } from 'react'
import type { Nullable } from '~/types/utils'

export type AIStreamEvent<F = unknown> =
  | { type: 'delta'; content: string }
  | { type: 'final'; data: F }
  | { type: 'done' }
  | { type: 'error'; message: string }

/**
 * Translates raw AI-stream error messages into user-friendly text.
 * Use at every AI call-site so users see actionable messages instead
 * of HTTP codes or stack traces.
 */
export function friendlyAIError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return 'Authorization issue. Please refresh the page or sign in again.'
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.'
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return 'The request timed out. Please try again.'
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('503')) {
    return 'The AI service is temporarily unavailable. Please try again in a minute.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network problem. Check your internet connection and try again.'
  }
  return raw
}

export interface AIStreamHandlers<F> {
  onDelta?: (chunk: string, accumulated: string) => void
  onFinal?: (data: F) => void
  onDone?: (accumulated: string) => void
  onError?: (message: string) => void
}

/**
 * Non-React helper that consumes a unified-protocol AI SSE stream.
 * Use this directly when you need to manage stream lifecycle outside
 * a single React component (e.g., per-row streams in a list).
 * Otherwise prefer the useAIStream hook.
 */
export async function consumeAIStream<F = unknown>(
  request: { url: string; init?: RequestInit; signal?: AbortSignal },
  handlers: AIStreamHandlers<F>,
): Promise<void> {
  const accumulator = { current: '' }
  try {
    const response = await fetch(request.url, {
      ...request.init,
      signal: request.signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as AIStreamEvent<F>
          if (event.type === 'delta') {
            accumulator.current += event.content
            handlers.onDelta?.(event.content, accumulator.current)
          } else if (event.type === 'final') {
            handlers.onFinal?.(event.data)
          } else if (event.type === 'done') {
            handlers.onDone?.(accumulator.current)
          } else if (event.type === 'error') {
            handlers.onError?.(event.message)
          }
        } catch {
          // ignore malformed line
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      const message = err instanceof Error ? err.message : 'Stream failed'
      handlers.onError?.(message)
    }
  }
}

interface UseAIStreamResult<F> {
  start: (input: { url: string; init?: RequestInit }) => Promise<void>
  cancel: () => void
  text: string
  isStreaming: boolean
  finalData: Nullable<F>
  error: Nullable<string>
}

/**
 * React hook wrapping consumeAIStream. Manages local state (text,
 * isStreaming, finalData, error) and AbortController lifecycle.
 */
export function useAIStream<F = unknown>(
  options: AIStreamHandlers<F> = {},
): UseAIStreamResult<F> {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [finalData, setFinalData] = useState<Nullable<F>>(null)
  const [error, setError] = useState<Nullable<string>>(null)
  const abortRef = useRef<Nullable<AbortController>>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const start = useCallback(
    async ({ url, init }: { url: string; init?: RequestInit }) => {
      setText('')
      setFinalData(null)
      setError(null)
      setIsStreaming(true)
      abortRef.current = new AbortController()
      await consumeAIStream<F>(
        { url, init, signal: abortRef.current.signal },
        {
          onDelta: (chunk, accumulated) => {
            setText(accumulated)
            optionsRef.current.onDelta?.(chunk, accumulated)
          },
          onFinal: data => {
            setFinalData(data)
            optionsRef.current.onFinal?.(data)
          },
          onDone: accumulated => optionsRef.current.onDone?.(accumulated),
          onError: message => {
            setError(message)
            optionsRef.current.onError?.(message)
          },
        },
      )
      setIsStreaming(false)
    },
    [],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { start, cancel, text, isStreaming, finalData, error }
}
