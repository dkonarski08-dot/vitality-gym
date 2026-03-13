// lib/rateLimiter.ts
// In-memory rate limiter for login attempts.
// Limits: 5 failed attempts per username per 15-minute window.
// Note: Per-instance in Vercel serverless — acceptable for single-gym internal tool.

interface AttemptRecord {
  count: number
  resetAt: number
}

const WINDOW_MS = 15 * 60 * 1000  // 15 minutes
const MAX_FAILS = 5

const store = new Map<string, AttemptRecord>()

/** Returns true if the request is allowed (not over limit). */
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const rec = store.get(key)
  if (!rec || now > rec.resetAt) return true  // no prior failures or window expired
  return rec.count < MAX_FAILS
}

/** Call after a failed login attempt. */
export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const rec = store.get(key)
  if (!rec || now > rec.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    rec.count++
  }
}

/** Call after a successful login to clear the counter. */
export function resetRateLimit(key: string): void {
  store.delete(key)
}
