// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; pin?: string }
    const { name, pin } = body

    if (!name || !pin) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('name, role, employee_id, pin_hash, is_active')
      .eq('gym_id', GYM_ID)
      .eq('name', name)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Акаунтът е деактивиран' }, { status: 403 })
    }

    const isValid = await compare(pin, user.pin_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    return NextResponse.json({
      name: user.name,
      role: user.role,
      employeeId: user.employee_id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
