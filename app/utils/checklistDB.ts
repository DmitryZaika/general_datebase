import { openDB, type IDBPDatabase } from 'idb'
import type { ChecklistFormData } from '~/schemas/checklist'

const DB_NAME = 'ChecklistDB'
const DB_VERSION = 1
const STORE_NAME = 'pendingSubmissions'
const MAX_QUEUE_SIZE = 50

// Pending submission interface
export interface PendingSubmission {
  id?: number
  data: ChecklistFormData
  companyId: number
  timestamp: number
  attempts: number
  lastAttempt: number | null
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

let dbInstance: IDBPDatabase | null = null

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          })

          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('companyId', 'companyId', { unique: false })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('attempts', 'attempts', { unique: false })

          console.log('[ChecklistDB] Database and indexes created successfully')
        }
      },
      blocked() {
        console.warn('[ChecklistDB] Database blocked by another connection')
      },
      blocking() {
        console.warn('[ChecklistDB] This connection is blocking a newer version')
      },
      terminated() {
        console.error('[ChecklistDB] Database connection terminated unexpectedly')
        dbInstance = null
      },
    })

    console.log('[ChecklistDB] Database opened successfully')
    return dbInstance
  } catch (error) {
    console.error('[ChecklistDB] Failed to open database:', error)
    throw new Error('Failed to initialize IndexedDB')
  }
}

export async function addToQueue(
  submission: Omit<PendingSubmission, 'id'>
): Promise<number> {
  try {
    const db = await initDB()

    // Check queue size limit
    const currentCount = await db.count(STORE_NAME)
    if (currentCount >= MAX_QUEUE_SIZE) {
      throw new Error(
        `Queue is full (${MAX_QUEUE_SIZE} submissions). Please try again later.`
      )
    }

    // Add to queue
    const id = await db.add(STORE_NAME, submission)
    console.log(`[ChecklistDB] Added submission to queue with ID: ${id}`)

    return id as number
  } catch (error) {
    console.error('[ChecklistDB] Failed to add to queue:', error)

    // Handle quota exceeded error
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error(
        'Storage quota exceeded. Please clear old submissions or free up space.'
      )
    }

    throw error
  }
}

export async function getAllPending(): Promise<PendingSubmission[]> {
  try {
    const db = await initDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const index = tx.store.index('timestamp')

    // Get all submissions ordered by timestamp (oldest first)
    const submissions = await index.getAll()
    await tx.done

    return submissions
  } catch (error) {
    console.error('[ChecklistDB] Failed to get pending submissions:', error)
    return []
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await initDB()
    const count = await db.count(STORE_NAME)
    return count
  } catch (error) {
    console.error('[ChecklistDB] Failed to get pending count:', error)
    return 0
  }
}

export async function getSubmissionById(
  id: number
): Promise<PendingSubmission | undefined> {
  try {
    const db = await initDB()
    const submission = await db.get(STORE_NAME, id)
    return submission
  } catch (error) {
    console.error(`[ChecklistDB] Failed to get submission ${id}:`, error)
    return undefined
  }
}

export async function updateSubmission(
  id: number,
  updates: Partial<PendingSubmission>
): Promise<void> {
  try {
    const db = await initDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')

    // Get current submission
    const current = await tx.store.get(id)
    if (!current) {
      throw new Error(`Submission ${id} not found`)
    }

    // Merge updates
    const updated = { ...current, ...updates, id }

    // Put back
    await tx.store.put(updated)
    await tx.done

    console.log(`[ChecklistDB] Updated submission ${id}:`, updates)
  } catch (error) {
    console.error(`[ChecklistDB] Failed to update submission ${id}:`, error)
    throw error
  }
}

export async function removeFromQueue(id: number): Promise<void> {
  try {
    const db = await initDB()
    await db.delete(STORE_NAME, id)
    console.log(`[ChecklistDB] Removed submission ${id} from queue`)
  } catch (error) {
    console.error(`[ChecklistDB] Failed to remove submission ${id}:`, error)
    throw error
  }
}

export async function clearFailed(): Promise<number> {
  try {
    const db = await initDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.store.index('status')

    // Get all failed submissions
    const failed = await index.getAll('failed')

    // Delete each one
    for (const submission of failed) {
      if (submission.id) {
        await tx.store.delete(submission.id)
      }
    }

    await tx.done

    console.log(`[ChecklistDB] Cleared ${failed.length} failed submissions`)
    return failed.length
  } catch (error) {
    console.error('[ChecklistDB] Failed to clear failed submissions:', error)
    return 0
  }
}

export async function clearAll(): Promise<void> {
  try {
    const db = await initDB()
    await db.clear(STORE_NAME)
    console.log('[ChecklistDB] Cleared all submissions')
  } catch (error) {
    console.error('[ChecklistDB] Failed to clear all submissions:', error)
    throw error
  }
}

export async function getSubmissionsByStatus(
  status: PendingSubmission['status']
): Promise<PendingSubmission[]> {
  try {
    const db = await initDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const index = tx.store.index('status')

    const submissions = await index.getAll(status)
    await tx.done

    return submissions
  } catch (error) {
    console.error(
      `[ChecklistDB] Failed to get submissions by status ${status}:`,
      error
    )
    return []
  }
}

export async function getSubmissionsByCompany(
  companyId: number
): Promise<PendingSubmission[]> {
  try {
    const db = await initDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const index = tx.store.index('companyId')

    const submissions = await index.getAll(companyId)
    await tx.done

    return submissions
  } catch (error) {
    console.error(
      `[ChecklistDB] Failed to get submissions for company ${companyId}:`,
      error
    )
    return []
  }
}

export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const LEGACY_KEY = 'pending_checklist_submission'
    const oldData = localStorage.getItem(LEGACY_KEY)

    if (!oldData) {
      return // No old data to migrate
    }

    const parsed = JSON.parse(oldData)

    // Add to IndexedDB
    await addToQueue({
      data: parsed.data,
      companyId: parsed.companyId,
      timestamp: parsed.timestamp,
      attempts: parsed.attempts || 0,
      lastAttempt: parsed.lastAttempt || null,
      status: 'pending',
    })

    // Clear old localStorage
    localStorage.removeItem(LEGACY_KEY)

    console.log('[ChecklistDB] Successfully migrated data from localStorage')
  } catch (error) {
    console.error('[ChecklistDB] Migration from localStorage failed:', error)
  }
}

export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return 'indexedDB' in window && window.indexedDB !== null
  } catch {
    return false
  }
}
