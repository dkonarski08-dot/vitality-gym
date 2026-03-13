// lib/session.ts
// Server-side session token: base64url(payload).hmac
// Uses Web Crypto API (crypto.subtle) — compatible with both Edge Runtime and Node.js 18+.

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

function toBase64url(str: string): string {
  // btoa only handles Latin-1; encode to UTF-8 first to support Cyrillic names
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + (4 - (str.length % 4)) % 4, '='
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const encoded = toBase64url(JSON.stringify(payload))
  const hmac = await hmacHex(encoded, getSecret())
  return `${encoded}.${hmac}`
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const encoded = token.slice(0, dot)
  const hmac = token.slice(dot + 1)
  const expected = await hmacHex(encoded, getSecret())
  // Constant-time comparison
  if (hmac.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < hmac.length; i++) {
    diff |= hmac.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (diff !== 0) return null
  try {
    return JSON.parse(fromBase64url(encoded)) as SessionPayload
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'vitality_sid'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds
