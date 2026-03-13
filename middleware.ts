// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

// Paths that don't require a valid session
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/auth/users',
  '/_next',
  '/favicon',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths through without session check
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Only gate API routes and page routes (not static assets)
  const isApiRoute = pathname.startsWith('/api/')
  const isPageRoute = !pathname.startsWith('/_next') && !pathname.includes('.')

  if (!isApiRoute && !isPageRoute) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? verifySession(token) : null

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Неоторизиран достъп' }, { status: 401 })
    }
    // Page route: redirect to login
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Inject verified session into request headers for use by route handlers
  const res = NextResponse.next()
  res.headers.set('x-session-role', session.role)
  res.headers.set('x-session-name', session.name)
  res.headers.set('x-session-employee-id', session.employeeId ?? '')
  return res
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
