import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChecklistFormData } from '~/schemas/checklist'
import {
  addToQueue,
  clearFailed,
  getAllPending,
  getPendingCount,
  isIndexedDBAvailable,
  migrateFromLocalStorage,
  type PendingSubmission,
  removeFromQueue,
  updateSubmission,
} from '~/utils/checklistDB'

interface UseChecklistQueueProps {
  companyId: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseChecklistQueueReturn {
  pendingCount: number
  isOnline: boolean
  isProcessing: boolean
  hasPendingSubmissions: boolean
  pendingSubmissions: PendingSubmission[]
  processQueue: () => Promise<void>
  addSubmissionToQueue: (data: ChecklistFormData) => Promise<number>
  clearFailedSubmissions: () => Promise<number>
  retrySubmission: (id: number) => Promise<void>
  deleteSubmission: (id: number) => Promise<void>
  refreshQueue: () => Promise<void>
}

const MAX_RETRY_ATTEMPTS = 20
const API_TIMEOUT = 8000
const RETRY_DELAY = 3000

export const isNetworkError = (error: Error): boolean => {
  return (
    error.name === 'AbortError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('Connection timeout') ||
    error.message.includes('Server error')
  )
}

const isValidationError = (message: string): boolean => {
  return (
    message.includes('status 400') ||
    message.includes('status 401') ||
    message.includes('status 403') ||
    message.includes('status 404') ||
    message.includes('errors')
  )
}

export async function submitChecklistAPI(
  formData: ChecklistFormData,
  companyId: number,
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    const response = await fetch(`/api/checklist/${companyId}`, {
      method: 'POST',
      body: JSON.stringify(formData),
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`)
      }
      if (response.status >= 400) {
        const errorData = await response.json().catch(() => ({}))
        if ('errors' in errorData) {
          throw new Error(JSON.stringify(errorData.errors))
        }
        throw new Error(`Request failed with status ${response.status}`)
      }
    }

    const data = await response.json()
    if ('errors' in data) {
      throw new Error(JSON.stringify(data.errors))
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && isNetworkError(error)) {
      throw new Error('Connection timeout or network error')
    }

    throw error
  }
}

export function useChecklistQueue({
  companyId,
  onSuccess,
  onError,
}: UseChecklistQueueProps): UseChecklistQueueReturn {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const isProcessingRef = useRef(false)
  const hasMigratedRef = useRef(false)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processQueueRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  }, [onSuccess, onError])

  const refreshQueue = useCallback(async () => {
    if (!isIndexedDBAvailable()) return

    const count = await getPendingCount()
    const submissions = await getAllPending()

    setPendingCount(count)
    setPendingSubmissions(submissions)
  }, [])

  useEffect(() => {
    setIsHydrated(true)
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    if (!hasMigratedRef.current && isIndexedDBAvailable()) {
      migrateFromLocalStorage()
        .then(() => {
          hasMigratedRef.current = true
          return refreshQueue()
        })
        .catch(() => undefined)
    } else {
      refreshQueue()
    }
  }, [refreshQueue])

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || !isIndexedDBAvailable() || !navigator.onLine) {
      return
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    isProcessingRef.current = true
    setIsProcessing(true)

    try {
      const pending = await getAllPending()

      if (pending.length === 0) {
        return
      }

      for (const submission of pending) {
        if (!navigator.onLine) break
        if (submission.status === 'syncing') continue

        const submissionId = submission.id
        if (submissionId === undefined) continue

        if (submission.attempts >= MAX_RETRY_ATTEMPTS) {
          await updateSubmission(submissionId, {
            status: 'failed',
            error: `Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached`,
          })
          continue
        }

        const lastAttemptTime = submission.lastAttempt || 0
        const timeSinceLastAttempt = Date.now() - lastAttemptTime

        if (submission.attempts > 0 && timeSinceLastAttempt < RETRY_DELAY) {
          continue
        }

        try {
          await updateSubmission(submissionId, {
            status: 'syncing',
            attempts: submission.attempts + 1,
            lastAttempt: Date.now(),
          })

          await submitChecklistAPI(submission.data, submission.companyId)
          await removeFromQueue(submissionId)

          if (
            typeof window !== 'undefined' &&
            window.location.pathname.includes('/checklist')
          ) {
            onSuccessRef.current?.()
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const isValidation = isValidationError(errorMessage)

          if (isValidation) {
            await removeFromQueue(submissionId)
          } else {
            await updateSubmission(submissionId, {
              status: 'pending',
              error: errorMessage,
            })
          }

          onErrorRef.current?.(error instanceof Error ? error : new Error(errorMessage))
        }
      }
    } catch {
      return
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)

      const remaining = await getAllPending()
      setPendingCount(remaining.length)
      setPendingSubmissions(remaining)

      const hasRetryable = remaining.some(
        submission =>
          submission.status !== 'failed' && submission.attempts < MAX_RETRY_ATTEMPTS,
      )

      if (
        hasRetryable &&
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        !retryTimeoutRef.current
      ) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null
          processQueueRef.current?.()
        }, RETRY_DELAY)
      }
    }
  }, [])

  useEffect(() => {
    processQueueRef.current = processQueue
  }, [processQueue])

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (isProcessingRef.current) return

    if (navigator.onLine && pendingCount > 0) {
      processQueue()
    }
  }, [processQueue, pendingCount])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      processQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processQueue])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (!document.hidden && !isProcessingRef.current) {
        refreshQueue().then(() => {
          if (navigator.onLine && pendingCount > 0 && !isProcessingRef.current) {
            processQueue()
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [processQueue, refreshQueue, pendingCount])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const ACTIVE_INTERVAL = 2 * 60 * 1000
    const BACKGROUND_INTERVAL = 10 * 60 * 1000

    const getInterval = () => (document.hidden ? BACKGROUND_INTERVAL : ACTIVE_INTERVAL)

    const checkQueue = () => {
      if (navigator.onLine && pendingCount > 0 && !isProcessingRef.current) {
        processQueue()
      }
    }

    let intervalId = setInterval(checkQueue, getInterval())

    const handleVisibilityChange = () => {
      clearInterval(intervalId)
      intervalId = setInterval(checkQueue, getInterval())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [processQueue, pendingCount])

  const addSubmissionToQueue = useCallback(
    async (data: ChecklistFormData): Promise<number> => {
      if (!isIndexedDBAvailable()) {
        throw new Error('IndexedDB not available')
      }

      const id = await addToQueue({
        data,
        companyId,
        timestamp: Date.now(),
        attempts: 0,
        lastAttempt: null,
        status: 'pending',
      })

      await refreshQueue()
      return id
    },
    [companyId, refreshQueue],
  )

  const clearFailedSubmissions = useCallback(async (): Promise<number> => {
    if (!isIndexedDBAvailable()) {
      throw new Error('IndexedDB not available')
    }

    const count = await clearFailed()
    await refreshQueue()
    return count
  }, [refreshQueue])

  const retrySubmission = useCallback(
    async (id: number): Promise<void> => {
      if (!isIndexedDBAvailable() || !navigator.onLine) {
        throw new Error('IndexedDB not available or offline')
      }

      await updateSubmission(id, {
        status: 'pending',
        attempts: 0,
        error: undefined,
      })

      await refreshQueue()
      await processQueue()
    },
    [refreshQueue, processQueue],
  )

  const deleteSubmission = useCallback(
    async (id: number): Promise<void> => {
      if (!isIndexedDBAvailable()) {
        throw new Error('IndexedDB not available')
      }

      await removeFromQueue(id)
      await refreshQueue()
    },
    [refreshQueue],
  )

  return {
    pendingCount,
    isOnline: isHydrated ? isOnline : true,
    isProcessing,
    hasPendingSubmissions: pendingCount > 0,
    pendingSubmissions,
    processQueue,
    addSubmissionToQueue,
    clearFailedSubmissions,
    retrySubmission,
    deleteSubmission,
    refreshQueue,
  }
}
