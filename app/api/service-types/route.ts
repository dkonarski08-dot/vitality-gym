// app/api/service-types/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/requireRole'
import { GYM_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  const businessUnit = req.nextUrl.searchParams.get('business_unit')
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'

  try {
    let query = supabaseAdmin
      .from('service_types')
      .select('*')
      .eq('gym_id', GYM_ID)
      .order('category')
      .order('name')

    if (!includeInactive) query = query.eq('active', true)
    if (businessUnit) query = query.eq('business_unit', businessUnit)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    return NextResponse.json({ service_types: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin')
  if (authError) return authError

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { name, price, category, business_unit, integration_type, duration_days } = body
      if (!name?.trim() || !price || !category?.trim() || !business_unit || !integration_type) {
        return NextResponse.json({ error: 'Всички полета са задължителни' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('service_types')
        .insert({
          gym_id: GYM_ID,
          name: name.trim(),
          price,
          category: category.trim(),
          business_unit,
          integration_type,
          duration_days: duration_days ?? null,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
      return NextResponse.json({ service_type: data })
    }

    if (action === 'update') {
      const { id, ...rest } = body
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
      const updates = { ...rest }
      delete updates.action
      const { data, error } = await supabaseAdmin
        .from('service_types')
        .update(updates)
        .eq('id', id)
        .eq('gym_id', GYM_ID)
        .select()
        .single()
      if (error) return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
      return NextResponse.json({ service_type: data })
    }

    if (action === 'toggle') {
      const { id, active } = body
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
      const { data, error } = await supabaseAdmin
        .from('service_types')
        .update({ active })
        .eq('id', id)
        .eq('gym_id', GYM_ID)
        .select()
        .single()
      if (error) return NextResponse.json({ error: 'Грешка' }, { status: 500 })
      return NextResponse.json({ service_type: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
