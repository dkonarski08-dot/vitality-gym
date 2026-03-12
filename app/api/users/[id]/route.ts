// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

const USER_COLUMNS = 'id, gym_id, name, role, employee_id, phone, birth_date, hired_at, is_active, created_at, updated_at'

async function getActiveAdminCountExcluding(id: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', GYM_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', id)
  return count ?? 0
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as {
      name: string
      role: string
      pin?: string
      phone?: string
      birth_date?: string
      hired_at?: string
      employee_id?: string
    }
    const { name, role, pin, phone, birth_date, hired_at, employee_id } = body

    const { data: current } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', id)
      .single()

    if (current?.role === 'admin' && role !== 'admin') {
      const otherAdmins = await getActiveAdminCountExcluding(id)
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: 'Не можеш да смениш ролята на единствения администратор' },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, unknown> = {
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      birth_date: birth_date || null,
      hired_at: hired_at || null,
      employee_id: employee_id || null,
      updated_at: new Date().toISOString(),
    }

    if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
      updates.pin_hash = await hash(pin, 10)
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .eq('gym_id', GYM_ID)
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

    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { is_active } = await req.json() as { is_active: boolean }

    if (!is_active) {
      const { data: current } = await supabaseAdmin
        .from('app_users')
        .select('role')
        .eq('id', id)
        .single()

      if (current?.role === 'admin') {
        const otherAdmins = await getActiveAdminCountExcluding(id)
        if (otherAdmins === 0) {
          return NextResponse.json(
            { error: 'Не можеш да деактивираш единствения администратор' },
            { status: 400 }
          )
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('gym_id', GYM_ID)
      .select(USER_COLUMNS)
      .single()

    if (error) throw error
    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
