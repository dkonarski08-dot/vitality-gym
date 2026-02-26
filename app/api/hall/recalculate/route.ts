import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { month } = await req.json()
    if (!month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })

    const { data: attendance, error } = await supabase
      .from('hall_attendance')
      .select('*, hall_classes(*)')
      .eq('month', month)

    if (error) throw error
    if (!attendance?.length) return NextResponse.json({ updated: 0 })

    let updated = 0

    for (const row of attendance) {
      const cls = row.hall_classes
      if (!cls) continue

      const revCash = row.visits_cash * (cls.price_cash || 0)
      const revSub = row.visits_subscription * (cls.price_subscription || 0)
      const revMulti = row.visits_multisport * (cls.price_multisport || 0)
      const revCool = row.visits_coolfit * (cls.price_coolfit || 0)
      const totalRevenue = revCash + revSub + revMulti + revCool

      // Trigger изчислява instructor_fee и final_payment автоматично
      await supabase.from('hall_attendance').update({
        revenue_cash: revCash,
        revenue_subscription: revSub,
        revenue_multisport: revMulti,
        revenue_coolfit: revCool,
        total_revenue: totalRevenue,
      }).eq('id', row.id)

      updated++
    }

    return NextResponse.json({ success: true, updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}