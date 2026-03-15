// app/api/shifts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { requireRole } from '@/lib/requireRole'
import { serverError } from '@/lib/serverError'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const type = searchParams.get('type')

    // Get settings
    if (type === 'settings') {
      const { data } = await supabase.from('gym_settings').select('*').eq('gym_id', GYM_ID).single()
      return NextResponse.json({ settings: data })
    }

    // Get holidays for a month
    if (type === 'holidays') {
      if (!month) return NextResponse.json({ holidays: [] })
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const { data } = await supabase
        .from('public_holidays')
        .select('*')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
      return NextResponse.json({ holidays: data || [] })
    }

    // Get staff + shifts
    const { data: staff } = await supabase
      .from('employees')
      .select('*')
      .eq('gym_id', GYM_ID)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (!month) return NextResponse.json({ staff, shifts: [] })

    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, staff:employees(id, name, role)')
      .eq('gym_id', GYM_ID)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
      .order('date')

    return NextResponse.json({ shifts: shifts || [], staff: staff || [] })
  } catch (err) {
    return serverError('shifts GET', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authErr = requireRole(req, 'admin')
    if (authErr) return authErr

    const body = await req.json()
    const { action } = body

    // ── Save settings ──
    if (action === 'save_settings') {
      const { weekday_open, weekday_close, weekday_shift_duration_minutes,
        saturday_open, saturday_close, saturday_shifts,
        sunday_open, sunday_close, sunday_shifts } = body
      const { error } = await supabase.from('gym_settings').update({
        weekday_open, weekday_close, weekday_shift_duration_minutes,
        saturday_open, saturday_close, saturday_shifts,
        sunday_open, sunday_close, sunday_shifts,
        updated_at: new Date().toISOString(),
      }).eq('gym_id', GYM_ID)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Add staff ──
    if (action === 'add_staff') {
      const { name, role, hourly_rate, phone } = body
      if (!name) return NextResponse.json({ error: 'Липсва име' }, { status: 400 })
      const { data, error } = await supabase
        .from('employees')
        .insert([{ gym_id: GYM_ID, name, role: role || 'Reception', hourly_rate: hourly_rate || 0, phone, active: true }])
        .select().single()
      if (error) throw error
      return NextResponse.json({ success: true, staff: data })
    }

    // ── Edit staff ──
    if (action === 'edit_staff') {
      const { staff_id, name, role, phone } = body
      if (!staff_id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      const { error } = await supabase
        .from('employees')
        .update({ name, role, phone, updated_at: new Date().toISOString() })
        .eq('id', staff_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Reorder staff ──
    if (action === 'reorder_staff') {
      // Receives array of { id, sort_order }
      const { order } = body as { order: Array<{ id: string; sort_order: number }> }
      if (!order || !Array.isArray(order)) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })
      // Batch update using individual updates (Supabase doesn't support bulk update easily)
      await Promise.all(
        order.map(({ id, sort_order }) =>
          supabase.from('employees').update({ sort_order, updated_at: new Date().toISOString() }).eq('id', id)
        )
      )
      return NextResponse.json({ success: true })
    }

    // ── Toggle staff active ──
    if (action === 'toggle_staff') {
      const { staff_id, active } = body
      const { error } = await supabase
        .from('employees')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', staff_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Delete single shift ──
    if (action === 'delete') {
      const { staff_id, date } = body
      const { error } = await supabase.from('shifts').delete().eq('staff_id', staff_id).eq('date', date)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Delete ALL shifts for a month ──
    if (action === 'delete_month') {
      const { month } = body
      if (!month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const { error, count } = await supabase
        .from('shifts')
        .delete()
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
      if (error) throw error
      return NextResponse.json({ success: true, count: count ?? 0 })
    }

    // ── Bulk assign (Mon-Fri for a specific week) ──
    if (action === 'bulk_weekdays') {
      const { staff_id, month, shift_type, start_time, end_time, week_monday } = body
      if (!staff_id || !month || !week_monday) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })

      // Use the explicit Monday passed from the frontend
      const monday = new Date(week_monday + 'T12:00:00')
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)

      // Clamp to month boundaries so we don't spill into adjacent months
      const [y, m] = month.split('-').map(Number)
      const monthStart = new Date(y, m - 1, 1)
      const monthEnd = new Date(y, m, 0)
      const weekStart = monday < monthStart ? monthStart : monday
      const weekEnd = friday > monthEnd ? monthEnd : friday

      const rows = []
      const cur = new Date(weekStart)
      while (cur <= weekEnd) {
        const dow = cur.getDay()
        if (dow >= 1 && dow <= 5) {
          const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
          rows.push({
            staff_id, date: dateStr,
            start_time, end_time, shift_type: shift_type || 'first',
            updated_at: new Date().toISOString(),
          })
        }
        cur.setDate(cur.getDate() + 1)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('shifts').upsert(rows, { onConflict: 'staff_id,date' })
        if (error) throw error
      }

      return NextResponse.json({ success: true, count: rows.length })
    }

    // ── Copy from previous month ──
    // Strategy: copy by day-of-week pattern (Mon→Mon, Tue→Tue etc.)
    // For each week in the target month, find the matching week in the previous month
    // and copy the same weekday shifts.
    if (action === 'copy_month') {
      const { target_month } = body
      if (!target_month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })

      const [ty, tm] = target_month.split('-').map(Number)

      // Previous month boundaries
      const prevDate = new Date(ty, tm - 2, 1)
      const prevYear = prevDate.getFullYear()
      const prevMonth = prevDate.getMonth() + 1 // 1-based
      const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()

      // Target month boundaries
      const targetLastDay = new Date(ty, tm, 0).getDate()

      // Fetch all shifts from previous month
      const { data: prevShifts, error: fetchError } = await supabase
        .from('shifts')
        .select('staff_id, date, start_time, end_time, shift_type, notes')
        .gte('date', `${prevMonthStr}-01`)
        .lte('date', `${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`)

      if (fetchError) throw fetchError

      if (!prevShifts || prevShifts.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'Няма смени в предходния месец' })
      }

      // Build a map: staffId → Map<dayOfWeek(0-6), shift[]>
      // We use ISO week numbers relative to the start of the month to handle
      // "which week" — but the simplest robust approach is:
      // For each target day, find the "corresponding" previous month day:
      // the closest same-weekday. We look for a prev month day with the same DOW
      // in the same week-of-month position.
      //
      // Week-of-month position: floor((dayOfMonth - 1) / 7) → week 0,1,2,3,4
      // Then within that week position, match same DOW.

      // Build source map: weekPosition → dow → { staff_id, shift }
      type ShiftRow = { staff_id: string; date: string; start_time: string; end_time: string; shift_type: string; notes: string | null }
      const srcMap = new Map<string, ShiftRow>()
      for (const s of prevShifts) {
        const day = parseInt(s.date.split('-')[2])
        const weekPos = Math.floor((day - 1) / 7) // 0..4
        const dow = new Date(s.date + 'T12:00:00').getDay() // 0=Sun..6=Sat
        srcMap.set(`${s.staff_id}|${weekPos}|${dow}`, s)
      }

      const newShifts: Array<Omit<ShiftRow, 'date'> & { date: string; updated_at: string }> = []

      for (let d = 1; d <= targetLastDay; d++) {
        const targetDateStr = `${target_month}-${String(d).padStart(2, '0')}`
        const targetDow = new Date(targetDateStr + 'T12:00:00').getDay()
        const weekPos = Math.floor((d - 1) / 7)

        // Get all staff that had a shift on that weekPos+dow in prev month
        for (const [key, srcShift] of srcMap.entries()) {
          const [staffId, wp, dow] = key.split('|')
          if (parseInt(wp) === weekPos && parseInt(dow) === targetDow) {
            newShifts.push({
              staff_id: staffId,
              date: targetDateStr,
              start_time: srcShift.start_time,
              end_time: srcShift.end_time,
              shift_type: srcShift.shift_type,
              notes: srcShift.notes,
              updated_at: new Date().toISOString(),
            })
          }
        }
      }

      if (newShifts.length > 0) {
        const { error } = await supabase.from('shifts').upsert(newShifts, { onConflict: 'staff_id,date' })
        if (error) throw error
      }

      return NextResponse.json({ success: true, count: newShifts.length })
    }

    // ── Create/update single shift ──
    const { staff_id, date, start_time, end_time, shift_type, notes } = body
    if (!staff_id || !date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Липсващи данни' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('shifts')
      .upsert({
        staff_id, date, start_time, end_time,
        shift_type: shift_type || 'custom',
        notes, updated_at: new Date().toISOString(),
      }, { onConflict: 'staff_id,date' })
      .select('*, staff:employees(id, name, role)')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, shift: data })
  } catch (err) {
    return serverError('shifts POST', err)
  }
}
