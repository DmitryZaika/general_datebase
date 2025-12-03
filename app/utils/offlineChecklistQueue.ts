import type { ChecklistFormData } from '~/schemas/checklist'

export interface PendingChecklistSubmission {
  data: ChecklistFormData
  companyId: number
  timestamp: number
  attempts: number
  lastAttempt: number | null
}

const PENDING_KEY = 'pending_checklist_submission'

export function savePending(submission: PendingChecklistSubmission): void {
  const json = JSON.stringify(submission)

  try {
    localStorage.setItem(PENDING_KEY, json)
  } catch (error) {
    console.error('Failed to save pending checklist submission:', error)

    if (error instanceof Error && error.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem('checklistData')
        localStorage.setItem(PENDING_KEY, json)
        console.warn('Cleared checklistData to make space for pending submission')
      } catch (retryError) {
        throw new Error(
          'Storage full. Please clear browser data or close other tabs and try again.',
        )
      }
    }

    throw error
  }
}

export function getPending(): PendingChecklistSubmission | null {
  try {
    const json = localStorage.getItem(PENDING_KEY)
    if (!json) return null

    const parsed = JSON.parse(json) as PendingChecklistSubmission
    return parsed
  } catch (error) {
    console.error('Failed to get pending checklist submission:', error)
    return null
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch (error) {
    console.error('Failed to clear pending checklist submission:', error)
  }
}

export function hasPending(): boolean {
  return getPending() !== null
}

export class OfflineError extends Error {
  constructor(message: string = 'No internet connection') {
    super(message)
    this.name = 'OfflineError'
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message)
    this.name = 'NetworkError'
  }
}
