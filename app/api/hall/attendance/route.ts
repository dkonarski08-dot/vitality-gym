// app/api/hall/attendance/route.ts
// Server-side handler for updating individual hall_attendance rows.
// Keeps all DB writes server-side — never call supabase directly from client for mutations.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { serverError } from '@/lib/serverError'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // Update a single attendance row, recomputing revenue and payment
    if (action === 'update_row') {
      const { id, visits_cash, visits_subscription, visits_multisport, visits_coolfit,
              instructor_percent, adjustments, adjustment_notes } = body

      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

      // Fetch class prices so we can recalculate revenue server-side
      const { data: row, error: fetchErr } = await supabase
        .from('hall_attendance')
        .select('hall_classes(price_cash, price_subscription, price_multisport, price_coolfit)')
        .eq('id', id)
        .single()

      if (fetchErr) throw fetchErr

      // Supabase returns joined row as a single object (not array) when using .single()
      const cls = (row?.hall_classes as unknown as Record<string, number> | null) ?? {}

      const revCash  = visits_cash         * (cls.price_cash         ?? 0)
      const revSub   = visits_subscription * (cls.price_subscription ?? 0)
      const revMulti = visits_multisport   * (cls.price_multisport   ?? 0)
      const revCool  = visits_coolfit      * (cls.price_coolfit      ?? 0)
      const totalRevenue = revCash + revSub + revMulti + revCool
      const totalVisits  = visits_cash + visits_subscription + visits_multisport + visits_coolfit
      const instructorFee = totalRevenue * ((instructor_percent ?? 0) / 100)
      const finalPayment  = instructorFee + (adjustments ?? 0)

      const { error } = await supabase
        .from('hall_attendance')
        .update({
          visits_cash, visits_subscription, visits_multisport, visits_coolfit,
          total_visits:        totalVisits,
          revenue_cash:        revCash,
          revenue_subscription: revSub,
          revenue_multisport:  revMulti,
          revenue_coolfit:     revCool,
          total_revenue:       totalRevenue,
          instructor_percent,
          adjustments:         adjustments ?? 0,
          adjustment_notes:    adjustment_notes ?? null,
          instructor_fee:      instructorFee,
          final_payment:       finalPayment,
        })
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Toggle month lock
    if (action === 'toggle_lock') {
      const { month, is_locked } = body
      if (!month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })

      const { error } = await supabase
        .from('hall_month_status')
        .upsert(
          [{ month, is_locked }],
          { onConflict: 'month' }
        )
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Apply reconciliation visit counts from operator reports
    if (action === 'apply_reconciliation') {
      const { reconciliation: rows } = body as { reconciliation: { attendance_id: string; operator: string; visits_operator: number }[] }
      if (!rows?.length) return NextResponse.json({ success: true, updated: 0 })

      const updates = rows.map(r => {
        const field = r.operator === 'multisport' ? 'visits_multisport' : 'visits_coolfit'
        return supabase.from('hall_attendance').update({ [field]: r.visits_operator }).eq('id', r.attendance_id)
      })
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error
      return NextResponse.json({ success: true, updated: rows.length })
    }

    // Restore original (GymRealm) visit counts
    if (action === 'restore_original') {
      const { reconciliation: rows } = body as { reconciliation: { attendance_id: string; operator: string; visits_gymrealm: number }[] }
      if (!rows?.length) return NextResponse.json({ success: true, updated: 0 })

      const updates = rows.map(r => {
        const field = r.operator === 'multisport' ? 'visits_multisport' : 'visits_coolfit'
        return supabase.from('hall_attendance').update({ [field]: r.visits_gymrealm }).eq('id', r.attendance_id)
      })
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error
      return NextResponse.json({ success: true, updated: rows.length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return serverError('hall/attendance POST', err)
  }
}
