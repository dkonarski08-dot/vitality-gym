// app/api/suppliers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function GET() {
  try {
    // Fetch suppliers with computed stats from deliveries
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        deliveries!deliveries_supplier_id_fkey(
          id,
          total_amount,
          invoice_date,
          status
        )
      `)
      .eq('gym_id', GYM_ID)
      .order('name')

    if (error) throw error

    // Compute stats per supplier from joined deliveries
    const enriched = (suppliers || []).map(s => {
      const approvedDeliveries = (s.deliveries || []).filter(
        (d: { status: string }) => d.status === 'approved'
      )
      const total_deliveries = approvedDeliveries.length
      const total_amount = approvedDeliveries.reduce(
        (sum: number, d: { total_amount: number | null }) => sum + (d.total_amount || 0),
        0
      )
      const lastDelivery = approvedDeliveries
        .map((d: { invoice_date: string | null }) => d.invoice_date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { deliveries: _d, ...rest } = s
      return {
        ...rest,
        total_deliveries,
        total_amount,
        last_delivery_at: lastDelivery,
      }
    })

    return NextResponse.json({ suppliers: enriched })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, eik, product_types, website, address, payment_terms,
      contact_person, phone, email, notes,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert([{
        gym_id: GYM_ID,
        name: name.trim(),
        eik: eik || null,
        product_types: product_types || null,
        website: website || null,
        address: address || null,
        payment_terms: payment_terms || null,
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        active: true,
      }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ supplier: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, name, eik, product_types, website, address, payment_terms,
      contact_person, phone, email, notes, active,
    } = body

    if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (eik !== undefined) updateData.eik = eik || null
    if (product_types !== undefined) updateData.product_types = product_types || null
    if (website !== undefined) updateData.website = website || null
    if (address !== undefined) updateData.address = address || null
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms || null
    if (contact_person !== undefined) updateData.contact_person = contact_person || null
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null
    if (notes !== undefined) updateData.notes = notes || null
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .eq('gym_id', GYM_ID)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ supplier: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

    // Soft delete — set active = false
    const { error } = await supabase
      .from('suppliers')
      .update({ active: false })
      .eq('id', id)
      .eq('gym_id', GYM_ID)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
