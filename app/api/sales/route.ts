// app/api/sales/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { getTodayISO } from '@/lib/formatters'
import { requireRole, getSession } from '@/lib/requireRole'
import { serverError } from '@/lib/serverError'

export async function GET(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const businessUnit = searchParams.get('business_unit')

    // Hall financial data is admin-only
    if (businessUnit === 'hall') {
      const hallError = requireRole(req, 'admin')
      if (hallError) return hallError
    }

    if (type === 'products') {
      // Products eligible for sale — ordered by popularity
      const { data, error } = await supabase
        .from('delivery_products')
        .select('id, name, category, unit, selling_price, barcode, min_stock, active_for_sale, order_count')
        .eq('gym_id', GYM_ID)
        .eq('active_for_sale', true)
        .order('order_count', { ascending: false })
      if (error) throw error
      return NextResponse.json({ products: data || [] })
    }

    // Default: list sales
    const today = getTodayISO()
    const rangeFrom = from || today
    const rangeTo = to || today

    let query = supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('gym_id', GYM_ID)
      .gte('sale_date', rangeFrom)
      .lte('sale_date', rangeTo)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (businessUnit) query = query.eq('business_unit', businessUnit)

    const { data, error } = await query
    if (error) throw error

    const includeTabsTotal = searchParams.get('include_open_tabs_total') === 'true'
    if (includeTabsTotal) {
      const { data: tabs } = await supabase
        .from('open_tabs')
        .select('total_amount')
        .eq('gym_id', GYM_ID)
      const open_tabs_total = (tabs ?? []).reduce((sum: number, t: { total_amount: number }) => sum + Number(t.total_amount), 0)
      const open_tabs_count = (tabs ?? []).length
      return NextResponse.json({ sales: data || [], open_tabs_total, open_tabs_count })
    }

    return NextResponse.json({ sales: data || [] })
  } catch (err) {
    return serverError('sales GET', err)
  }
}

export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist')
  if (authError) return authError

  try {
    const body = await req.json()
    const { action } = body
    const session = getSession(req)

    if (action === 'create') {
      const { items, payment_method, member_id, notes, client_id, discount_amount = 0, business_unit = 'gym' } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Липсват продукти' }, { status: 400 })
      }
      if (!payment_method || !['cash', 'card'].includes(payment_method)) {
        return NextResponse.json({ error: 'Невалиден метод на плащане' }, { status: 400 })
      }

      const total = items.reduce((sum: number, i: { total_price: number }) => sum + (i.total_price || 0), 0)

      const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .insert([{
          gym_id: GYM_ID,
          total_amount: total,
          payment_method,
          member_id: member_id || null,
          client_id: client_id || null,
          discount_amount,
          business_unit,
          staff_name: session?.name || 'Unknown',
          notes: notes?.trim() || null,
        }])
        .select()
        .single()
      if (saleErr) throw saleErr

      const productItems = items.filter((i: { type?: string }) => i.type !== 'service')
      const serviceItems = items.filter((i: { type?: string }) => i.type === 'service')

      const saleItemRows = productItems.map((i: {
        product_id?: string
        id?: string
        product_name?: string
        name?: string
        category?: string
        quantity: number
        unit?: string
        unit_price: number
        total_price: number
      }) => ({
        sale_id: sale.id,
        product_id: i.product_id || i.id || null,
        product_name: i.product_name || i.name || '',
        category: i.category || null,
        quantity: i.quantity,
        unit: i.unit || null,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }))

      if (saleItemRows.length > 0) {
        const { error: itemsErr } = await supabase.from('sale_items').insert(saleItemRows)
        if (itemsErr) throw itemsErr
      }

      if (serviceItems.length > 0 && client_id) {
        await supabase.from('service_records').insert(
          serviceItems.map((i: { id: string; name: string; category: string; unit_price: number; starts_at?: string; ends_at?: string }) => ({
            gym_id: GYM_ID,
            client_id,
            service_type_id: i.id || null,
            sale_id: sale.id,
            starts_at: i.starts_at ?? null,
            ends_at: i.ends_at ?? null,
            details: { name: i.name, category: i.category, unit_price: i.unit_price },
          }))
        )
      }

      return NextResponse.json({ success: true, sale_id: sale.id, sale })
    }

    if (action === 'void') {
      const voidAuthError = requireRole(req, 'admin')
      if (voidAuthError) return voidAuthError

      const { sale_id } = body
      if (!sale_id) return NextResponse.json({ error: 'Липсва sale_id' }, { status: 400 })

      const { error } = await supabase
        .from('sales')
        .update({
          voided: true,
          voided_by: session?.name || 'Admin',
          voided_at: new Date().toISOString(),
        })
        .eq('id', sale_id)
        .eq('gym_id', GYM_ID)
      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return serverError('sales POST', err)
  }
}
