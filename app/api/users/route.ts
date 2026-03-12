// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { UserRole } from '@/src/types/database'

const USER_COLUMNS = 'id, gym_id, name, role, employee_id, phone, birth_date, hired_at, is_active, created_at, updated_at'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select(USER_COLUMNS)
      .eq('gym_id', GYM_ID)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

const VALID_ROLES: UserRole[] = ['admin', 'receptionist', 'instructor']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string
      role: UserRole
      pin: string
      phone?: string
      birth_date?: string
      hired_at?: string
      employee_id?: string
    }

    const { name, role, pin, phone, birth_date, hired_at, employee_id } = body

    if (!name?.trim() || !role || !VALID_ROLES.includes(role as UserRole) || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Невалидни данни' }, { status: 400 })
    }

    const pin_hash = await hash(pin, 10)

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .insert({
        gym_id: GYM_ID,
        name: name.trim(),
        role,
        pin_hash,
        phone: phone?.trim() || null,
        birth_date: birth_date || null,
        hired_at: hired_at || null,
        employee_id: employee_id || null,
        updated_at: new Date().toISOString(),
      })
      .select(USER_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Потребител с това име вече съществува' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ user: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
