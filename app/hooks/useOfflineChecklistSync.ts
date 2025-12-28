import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearPending,
  getPending,
  hasPending,
  savePending,
} from '~/utils/offlineChecklistQueue'

interface UseOfflineChecklistSyncProps {
  companyId: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseOfflineChecklistSyncReturn {
  isOnline: boolean
  hasPendingSubmission: boolean
  retryPending: () => Promise<void>
  isRetrying: boolean
}

const MAX_RETRY_ATTEMPTS = 20

async function submitChecklistAPI(
  formData: unknown,
  companyId: number,
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

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
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({}))
        if ('errors' in errorData) {
          throw new Error(JSON.stringify(errorData.errors))
        }
        throw new Error(`Request failed with status ${response.status}`)
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    if ('errors' in data) {
      throw new Error(JSON.stringify(data.errors))
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)

    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch'))
    ) {
      throw new Error('Connection timeout or network error')
    }

    throw error
  }
}

export function useOfflineChecklistSync({
  onSuccess,
  onError,
}: UseOfflineChecklistSyncProps): UseOfflineChecklistSyncReturn {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const [hasPendingSubmission, setHasPendingSubmission] = useState(() => hasPending())
  const [isRetrying, setIsRetrying] = useState(false)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    setIsHydrated(true)
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }
    setHasPendingSubmission(hasPending())
  }, [])

  const trySubmitPending = useCallback(async () => {
    if (isSubmittingRef.current) {
      console.log('Already submitting, skipping...')
      return
    }

    const pending = getPending()
    if (!pending) {
      setHasPendingSubmission(false)
      setIsRetrying(false)
      return
    }

    if (pending.attempts >= MAX_RETRY_ATTEMPTS) {
      console.error(
        `Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for checklist submission`,
      )
      setHasPendingSubmission(true)
      setIsRetrying(false)
      return
    }

    isSubmittingRef.current = true
    setIsRetrying(true)
    setHasPendingSubmission(true)

    savePending({
      ...pending,
      attempts: pending.attempts + 1,
      lastAttempt: Date.now(),
    })

    try {
      await submitChecklistAPI(pending.data, pending.companyId)

      const currentPending = getPending()
      if (currentPending && currentPending.timestamp === pending.timestamp) {
        clearPending()
      } else {
        console.log('Pending form was replaced during submission, not clearing')
      }

      setHasPendingSubmission(hasPending())
      setIsRetrying(false)
      isSubmittingRef.current = false
      onSuccess?.()
    } catch (error) {
      console.error('Failed to submit pending checklist:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (
        errorMessage.includes('status 400') ||
        errorMessage.includes('status 401') ||
        errorMessage.includes('status 403') ||
        errorMessage.includes('status 404') ||
        errorMessage.includes('errors')
      ) {
        clearPending()
        setHasPendingSubmission(false)
        setIsRetrying(false)
        isSubmittingRef.current = false
        onError?.(error instanceof Error ? error : new Error(errorMessage))
        return
      }

      setHasPendingSubmission(true)
      setIsRetrying(false)
      isSubmittingRef.current = false
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [onSuccess, onError])

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    if (navigator.onLine && hasPending()) {
      trySubmitPending()
    }
  }, [trySubmitPending])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      if (hasPending()) {
        trySubmitPending()
      }
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
  }, [trySubmitPending])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setHasPendingSubmission(hasPending())
        if (navigator.onLine && hasPending()) {
          trySubmitPending()
        }
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pending_checklist_submission') {
        setHasPendingSubmission(hasPending())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [trySubmitPending])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const getInterval = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return 10 * 60 * 1000
      }
      return 2 * 60 * 1000
    }

    let intervalId = setInterval(() => {
      if (navigator.onLine && hasPending()) {
        trySubmitPending()
      }
    }, getInterval())

    const handleVisibilityChangeForInterval = () => {
      clearInterval(intervalId)
      intervalId = setInterval(() => {
        if (navigator.onLine && hasPending()) {
          trySubmitPending()
        }
      }, getInterval())
    }

    document.addEventListener('visibilitychange', handleVisibilityChangeForInterval)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChangeForInterval,
      )
    }
  }, [trySubmitPending])

  const retryPending = useCallback(async () => {
    if (!navigator.onLine) {
      console.warn('Cannot retry while offline')
      return
    }
    await trySubmitPending()
  }, [trySubmitPending])

  return {
    isOnline: isHydrated ? isOnline : true,
    hasPendingSubmission,
    retryPending,
    isRetrying,
  }
}
