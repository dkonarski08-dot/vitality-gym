// app/api/hall/classes/route.ts
// PATCH handler for updating hall_class configuration fields.
// Extracted from page.tsx direct supabase calls (security: avoid client-side mutations).
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

const ALLOWED_FIELDS = new Set([
  'price_cash', 'price_subscription', 'price_multisport', 'price_coolfit',
  'instructor_percent', 'max_capacity', 'duration_minutes',
])

export async function PATCH(req: NextRequest) {
  try {
    const { id, field, value } = await req.json()

    if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
    if (!ALLOWED_FIELDS.has(field)) return NextResponse.json({ error: 'Невалидно поле' }, { status: 400 })
    if (typeof value !== 'number' || isNaN(value)) return NextResponse.json({ error: 'Невалидна стойност' }, { status: 400 })

    const { error } = await supabase
      .from('hall_classes')
      .update({ [field]: value })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[hall/classes error]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
