// lib/requireRole.ts
// Read the verified role injected by middleware via x-session-* headers.
// Call requireRole() at the top of any route handler that requires specific roles.
import { NextRequest, NextResponse } from 'next/server'

export type UserRole = 'admin' | 'receptionist' | 'instructor' | 'cleaning'

export interface RequestSession {
  role: UserRole
  name: string
  employeeId: string | null
}

/** Extract session from middleware-injected headers. Returns null if no valid session. */
export function getSession(req: NextRequest): RequestSession | null {
  const role = req.headers.get('x-session-role') as UserRole | null
  const name = req.headers.get('x-session-name')
  if (!role || !name) return null
  return {
    role,
    name,
    employeeId: req.headers.get('x-session-employee-id') || null,
  }
}

/**
 * Returns a 401/403 NextResponse if the request doesn't have an allowed role.
 * Returns null if authorized (proceed with handler).
 */
export function requireRole(
  req: NextRequest,
  ...allowedRoles: UserRole[]
): NextResponse | null {
  const session = getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Неоторизиран достъп' }, { status: 401 })
  }
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Нямате права за това действие' }, { status: 403 })
  }
  return null // authorized
}
