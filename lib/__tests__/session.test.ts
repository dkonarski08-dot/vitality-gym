import { describe, it, expect } from 'vitest'
import { signSession, verifySession } from '../session'

describe('session', () => {
  const payload = { name: 'Иван', role: 'admin', employeeId: null }

  it('signs and verifies a valid token', () => {
    const token = signSession(payload)
    const result = verifySession(token)
    expect(result).toEqual(payload)
  })

  it('returns null for tampered token', () => {
    const token = signSession(payload)
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(verifySession(tampered)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(verifySession('')).toBeNull()
  })

  it('returns null for token without dot separator', () => {
    expect(verifySession('nodothere')).toBeNull()
  })
})
