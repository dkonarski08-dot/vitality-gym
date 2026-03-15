// app/api/open-tabs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole, getSession } from '@/lib/requireRole'
import { GYM_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  const businessUnit = req.nextUrl.searchParams.get('business_unit')
  try {
    let query = supabaseAdmin
      .from('open_tabs')
      .select('*, client:clients(id, name, phone, discount_tier)')
      .eq('gym_id', GYM_ID)
      .order('created_at', { ascending: false })

    if (businessUnit) query = query.eq('business_unit', businessUnit)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    return NextResponse.json({ open_tabs: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  const session = getSession(req)

  try {
    const body = await req.json()
    const { action } = body

    // ── create_tab ────────────────────────────────────────────
    if (action === 'create_tab') {
      const { items, total_amount, discount_amount = 0, client_id, business_unit = 'gym' } = body
      if (!items?.length || total_amount === undefined) {
        return NextResponse.json({ error: 'items и total_amount са задължителни' }, { status: 400 })
      }
      const has_services = items.some((i: { type: string }) => i.type === 'service')
      if (has_services && !client_id) {
        return NextResponse.json({ error: 'Услугите изискват клиент' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('open_tabs')
        .insert({
          gym_id: GYM_ID,
          business_unit,
          client_id: client_id ?? null,
          has_services,
          items,
          total_amount,
          discount_amount,
          created_by: session?.name ?? 'Unknown',
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
      return NextResponse.json({ open_tab: data })
    }

    // ── pay_tab ───────────────────────────────────────────────
    if (action === 'pay_tab') {
      const { tab_id, payment_method } = body
      if (!tab_id || !payment_method) {
        return NextResponse.json({ error: 'tab_id и payment_method са задължителни' }, { status: 400 })
      }

      const { data: tab, error: fetchErr } = await supabaseAdmin
        .from('open_tabs')
        .select('*')
        .eq('id', tab_id)
        .eq('gym_id', GYM_ID)
        .single()
      if (fetchErr || !tab) return NextResponse.json({ error: 'Сметката не е намерена' }, { status: 404 })

      const { data: sale, error: saleErr } = await supabaseAdmin
        .from('sales')
        .insert({
          gym_id: GYM_ID,
          sale_date: new Date().toISOString().slice(0, 10),
          sale_time: new Date().toTimeString().slice(0, 8),
          total_amount: tab.total_amount,
          payment_method,
          client_id: tab.client_id,
          staff_name: session?.name ?? 'Unknown',
          business_unit: tab.business_unit,
          discount_amount: tab.discount_amount,
          open_tab_id: tab_id,
          voided: false,
        })
        .select()
        .single()
      if (saleErr || !sale) return NextResponse.json({ error: 'Грешка при създаване на продажба' }, { status: 500 })

      const productItems = tab.items.filter((i: { type: string }) => i.type === 'product')
      const serviceItems = tab.items.filter((i: { type: string }) => i.type === 'service')

      if (productItems.length > 0) {
        await supabaseAdmin.from('sale_items').insert(
          productItems.map((i: { id: string; name: string; category: string; quantity: number; unit_price: number; total_price: number }) => ({
            sale_id: sale.id,
            product_id: i.id || null,
            product_name: i.name,
            category: i.category,
            quantity: i.quantity,
            unit: 'шт.',
            unit_price: i.unit_price,
            total_price: i.total_price,
          }))
        )
      }

      if (serviceItems.length > 0 && tab.client_id) {
        await supabaseAdmin.from('service_records').insert(
          serviceItems.map((i: { id: string; name: string; category: string; unit_price: number; starts_at?: string; ends_at?: string }) => ({
            gym_id: GYM_ID,
            client_id: tab.client_id,
            service_type_id: i.id || null,
            sale_id: sale.id,
            starts_at: i.starts_at ?? null,
            ends_at: i.ends_at ?? null,
            details: { name: i.name, category: i.category, unit_price: i.unit_price },
          }))
        )
      }

      await supabaseAdmin.from('open_tabs').delete().eq('id', tab_id)

      return NextResponse.json({ sale })
    }

    // ── delete_tab (admin only) ───────────────────────────────
    if (action === 'delete_tab') {
      const adminError = requireRole(req, 'admin')
      if (adminError) return adminError

      const { tab_id } = body
      if (!tab_id) return NextResponse.json({ error: 'tab_id required' }, { status: 400 })

      await supabaseAdmin.from('open_tabs').delete().eq('id', tab_id).eq('gym_id', GYM_ID)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
