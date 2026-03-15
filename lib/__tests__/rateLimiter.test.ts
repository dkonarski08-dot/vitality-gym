import { describe, it, expect } from 'vitest'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../rateLimiter'

describe('rateLimiter', () => {
  // Use unique key per test run to avoid cross-test state
  const key = 'test-user-' + Date.now()

  it('allows first attempt', () => {
    expect(checkRateLimit(key)).toBe(true)
  })

  it('blocks after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(key)
    expect(checkRateLimit(key)).toBe(false)
  })

  it('allows again after reset', () => {
    resetRateLimit(key)
    expect(checkRateLimit(key)).toBe(true)
  })
})
