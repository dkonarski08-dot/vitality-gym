import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/requireRole'
import { serverError } from '@/lib/serverError'

export async function POST(req: NextRequest) {
  try {
    const authErr = requireRole(req, 'admin')
    if (authErr) return authErr

    const { month } = await req.json()
    if (!month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })

    const { data: attendance, error } = await supabase
      .from('hall_attendance')
      .select('*, hall_classes(*)')
      .eq('month', month)

    if (error) throw error
    if (!attendance?.length) return NextResponse.json({ updated: 0 })

    // Batch all updates in parallel — avoid N+1 sequential queries
    const updates = attendance
      .filter(row => row.hall_classes)
      .map(row => {
        const cls = row.hall_classes
        const revCash = row.visits_cash * (cls.price_cash || 0)
        const revSub = row.visits_subscription * (cls.price_subscription || 0)
        const revMulti = row.visits_multisport * (cls.price_multisport || 0)
        const revCool = row.visits_coolfit * (cls.price_coolfit || 0)
        return supabase.from('hall_attendance').update({
          revenue_cash: revCash,
          revenue_subscription: revSub,
          revenue_multisport: revMulti,
          revenue_coolfit: revCool,
          total_revenue: revCash + revSub + revMulti + revCool,
        }).eq('id', row.id)
      })

    await Promise.all(updates)
    const updated = updates.length

    return NextResponse.json({ success: true, updated })
  } catch (err) {
    return serverError('hall/recalculate POST', err)
  }
}