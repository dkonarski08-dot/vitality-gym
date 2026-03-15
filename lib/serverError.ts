// lib/serverError.ts
// Return a safe generic error to the client; log details server-side.
// Prevents leaking DB schema details, internal paths, or API keys via error messages.
import { NextResponse } from 'next/server'

export function serverError(context: string, err: unknown): NextResponse {
  console.error(`[${context}]`, err)
  return NextResponse.json({ error: 'Сървърна грешка' }, { status: 500 })
}
