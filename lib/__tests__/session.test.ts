import { describe, it, expect } from 'vitest'
import { signSession, verifySession } from '../session'

describe('session', () => {
  const payload = { name: 'Иван', role: 'admin', employeeId: null }

  it('signs and verifies a valid token', async () => {
    const token = await signSession(payload)
    const result = await verifySession(token)
    expect(result).toEqual(payload)
  })

  it('returns null for tampered token', async () => {
    const token = await signSession(payload)
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(await verifySession(tampered)).toBeNull()
  })

  it('returns null for empty string', async () => {
    expect(await verifySession('')).toBeNull()
  })

  it('returns null for token without dot separator', async () => {
    expect(await verifySession('nodothere')).toBeNull()
  })
})
