interface Bucket {
  tokens: number
  lastRefillAt: number
}

const buckets = new Map<number, Bucket>()

export interface AcquireSlotParams {
  userId: number
  capacity: number
  windowMs: number
}

export function acquireUserSlot(params: AcquireSlotParams): boolean {
  const now = Date.now()
  const refillPerMs = params.capacity / params.windowMs
  const existing = buckets.get(params.userId)
  const bucket: Bucket = existing
    ? {
        tokens: Math.min(
          params.capacity,
          existing.tokens + (now - existing.lastRefillAt) * refillPerMs,
        ),
        lastRefillAt: now,
      }
    : { tokens: params.capacity, lastRefillAt: now }

  if (bucket.tokens < 1) {
    buckets.set(params.userId, bucket)
    return false
  }
  bucket.tokens -= 1
  buckets.set(params.userId, bucket)
  return true
}

export function resetUserRateLimiter(): void {
  buckets.clear()
}
