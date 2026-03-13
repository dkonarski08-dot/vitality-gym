// lib/session.ts
// Server-side session token: base64url(payload).hmac
// Used in httpOnly cookie so middleware can verify identity without DB lookup.
import { createHmac } from 'crypto'

export interface SessionPayload {
  name: string
  role: string
  employeeId: string | null
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET env var is required in production')
  }
  return s ?? 'dev-secret-change-in-production'
}

export function signSession(payload: SessionPayload): string {
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString('base64url')
  const hmac = createHmac('sha256', getSecret()).update(encoded).digest('hex')
  return `${encoded}.${hmac}`
}

export function verifySession(token: string): SessionPayload | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const encoded = token.slice(0, dot)
  const hmac = token.slice(dot + 1)
  const expected = createHmac('sha256', getSecret()).update(encoded).digest('hex')
  if (hmac !== expected) return null
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'vitality_sid'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds
