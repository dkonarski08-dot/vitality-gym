// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/requireRole'
import { GYM_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const id = req.nextUrl.searchParams.get('id')

  try {
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('gym_id', GYM_ID)
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ client: data })
    }

    if (!q || q.length < 2) {
      return NextResponse.json({ clients: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('gym_id', GYM_ID)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order('name')
      .limit(10)

    if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    return NextResponse.json({ clients: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  try {
    const body = await req.json()
    const { name, phone, discount_tier = 'none', notes } = body

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Името и телефонът са задължителни' }, { status: 400 })
    }
    if (!['none', 'standard', 'vip'].includes(discount_tier)) {
      return NextResponse.json({ error: 'Невалидна отстъпка' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({ gym_id: GYM_ID, name: name.trim(), phone: phone.trim(), discount_tier, notes: notes ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
    return NextResponse.json({ client: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  try {
    const body = await req.json()
    const { id, name, phone, discount_tier, notes } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (phone !== undefined) updates.phone = phone.trim()
    if (discount_tier !== undefined) updates.discount_tier = discount_tier
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', id)
      .eq('gym_id', GYM_ID)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    return NextResponse.json({ client: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
