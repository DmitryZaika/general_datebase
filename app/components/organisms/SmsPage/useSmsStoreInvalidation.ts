import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { subscribe } from './mock-service'

// Bridges in-process mock mutations to TanStack Query so the UI reacts
// without waiting for the 15s poll. Becomes a no-op once real mutation
// hooks land in iteration 3.
export function useSmsStoreInvalidation() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === 'undefined') return
    return subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-threads'] })
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-thread'] })
      queryClient.invalidateQueries({ queryKey: ['cloudtalk-sms-unread-count'] })
    })
  }, [queryClient])
}
