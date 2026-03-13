// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { signSession, SESSION_COOKIE, COOKIE_MAX_AGE } from '@/lib/session'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rateLimiter'
import { serverError } from '@/lib/serverError'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; pin?: string }
    const { name, pin } = body

    if (!name || !pin) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    // Rate limit: 5 failed attempts per username per 15 min
    if (!checkRateLimit(name)) {
      return NextResponse.json(
        { error: 'Твърде много опити. Опитайте след 15 минути.' },
        { status: 429 }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('name, role, employee_id, pin_hash, is_active')
      .eq('gym_id', GYM_ID)
      .eq('name', name)
      .single()

    if (error || !user) {
      recordFailedAttempt(name)
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Акаунтът е деактивиран' }, { status: 403 })
    }

    const isValid = await compare(pin, user.pin_hash)
    if (!isValid) {
      recordFailedAttempt(name)
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    resetRateLimit(name)

    const payload = { name: user.name, role: user.role, employeeId: user.employee_id ?? null }
    const token = signSession(payload)

    const res = NextResponse.json({
      name: user.name,
      role: user.role,
      employeeId: user.employee_id,
    })

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    return res
  } catch (err) {
    return serverError('auth/login', err)
  }
}
