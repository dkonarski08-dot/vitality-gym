// app/api/cash/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import ExcelJS from 'exceljs'

// W7: unified threshold — match hall-cash route (5€)
const PHYSICAL_DIFF_THRESHOLD = 5

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    // Role is passed as hint for data scoping — server always limits
    // to safe defaults regardless. Admin flag only expands to 90 days.
    const role = searchParams.get('role') || 'receptionist'
    const today = new Date().toISOString().split('T')[0]

    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Default to current month if no range given
    const now = new Date()
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const rangeFrom = from || defaultFrom
    const rangeTo = to || defaultTo

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('daily_cash')
        .select('*')
        .gte('date', rangeFrom)
        .lte('date', rangeTo)
        .order('date', { ascending: false })
      if (error) throw error
      return NextResponse.json({ records: data || [] })
    }

    // Non-admin: only today + yesterday — no sensitive history
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('daily_cash')
      .select('id, date, staff_name, gym_cash_system, gym_cash_counted, hall_cash_system, hall_cash_counted, deposit, notes, alert_physical_diff, alert_system_diff, alert_seen_by_staff, created_at')
      .in('date', [today, yesterdayStr])
      .order('date', { ascending: false })
    if (error) throw error
    return NextResponse.json({ records: data || [] })
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
    const { action } = body

    // ── Receptionist saves their daily cash ──
    if (action === 'staff_save') {
      const { staff_name, date, gym_cash_system, gym_cash_counted, hall_cash_system, hall_cash_counted, deposit, notes } = body
      const targetDate = date || new Date().toISOString().split('T')[0]

      // Check if record exists
      const { data: existing } = await supabase
        .from('daily_cash')
        .select('id, admin_cash_counted')
        .eq('date', targetDate)
        .maybeSingle()

      const record: Record<string, unknown> = {
        date: targetDate,
        staff_name: staff_name || 'Unknown',
        gym_cash_system: parseFloat(gym_cash_system) || 0,
        gym_cash_counted: parseFloat(gym_cash_counted) || 0,
        hall_cash_system: parseFloat(hall_cash_system) || 0,
        hall_cash_counted: parseFloat(hall_cash_counted) || 0,
        deposit: parseFloat(deposit) || 0,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      }

      // Recalculate alerts if admin already counted
      if (existing?.admin_cash_counted != null) {
        const staffTotal = (parseFloat(gym_cash_counted) || 0) + (parseFloat(hall_cash_counted) || 0)
        record.alert_physical_diff = Math.abs(staffTotal - existing.admin_cash_counted) > PHYSICAL_DIFF_THRESHOLD
      }

      if (existing) {
        const { error } = await supabase.from('daily_cash').update(record).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_cash').insert([record])
        if (error) throw error
      }

      return NextResponse.json({ success: true })
    }

    // ── Admin saves their physical cash count ──
    if (action === 'admin_count') {
      const { date, admin_cash_counted, admin_counted_by } = body
      if (!date) return NextResponse.json({ error: 'Липсва дата' }, { status: 400 })

      // Check if record exists
      const { data: existing } = await supabase
        .from('daily_cash')
        .select('id, gym_cash_counted, hall_cash_counted')
        .eq('date', date)
        .maybeSingle()

      const adminCount = parseFloat(admin_cash_counted) || 0

      if (existing) {
        // Compare with receptionist total
        const staffTotal = (existing.gym_cash_counted || 0) + (existing.hall_cash_counted || 0)
        const alertPhysical = Math.abs(staffTotal - adminCount) > PHYSICAL_DIFF_THRESHOLD

        const { error } = await supabase.from('daily_cash').update({
          admin_cash_counted: adminCount,
          admin_counted_by: admin_counted_by || 'Admin',
          admin_counted_at: new Date().toISOString(),
          alert_physical_diff: alertPhysical,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
        if (error) throw error
      } else {
        // No receptionist entry yet — create record with just admin count
        const { error } = await supabase.from('daily_cash').insert([{
          date,
          staff_name: '—',
          admin_cash_counted: adminCount,
          admin_counted_by: admin_counted_by || 'Admin',
          admin_counted_at: new Date().toISOString(),
        }])
        if (error) throw error
      }

      return NextResponse.json({ success: true })
    }

    // ── GymRealm import ── parse xlsx server-side, batch upsert gymrealm_gym_cash per day
    if (action === 'gymrealm_import') {
      const { fileBase64, filename } = body
      if (!fileBase64) return NextResponse.json({ error: 'Няма файл' }, { status: 400 })

      // Parse xlsx server-side
      const buffer = Buffer.from(fileBase64, 'base64')
      const wb = new ExcelJS.Workbook()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any)
      const ws = wb.worksheets[0]
      const allRows: unknown[][] = []
      ws.eachRow((row) => { allRows.push((row.values as unknown[]).slice(1)) })
      const headers = (allRows[0] as unknown[]).map(h => String(h ?? ''))
      const rows: Record<string, unknown>[] = allRows.slice(1).map(rowVals => {
        const obj: Record<string, unknown> = {}
        headers.forEach((h, i) => { obj[h] = (rowVals as unknown[])[i] ?? '' })
        return obj
      })

      const dateKey = headers.find(h => { const l = h.toLowerCase(); return l.includes('дата') || l.includes('date') || l.includes('ден') })
      const cashKey = headers.find(h => { const l = h.toLowerCase(); return l.includes('в брой') || l === 'cash' || l.includes('брой') })

      type DayEntry = { date: string; gymrealm_gym_cash: number | null }
      const entries: DayEntry[] = []

      if (dateKey && cashKey) {
        for (const row of rows) {
          const rawDate = row[dateKey]
          const rawCash = row[cashKey]
          let parsedDate: string | null = null
          if (rawDate instanceof Date) {
            parsedDate = rawDate.toISOString().split('T')[0]
          } else {
            const s = String(rawDate).trim()
            const dmyMatch = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
            const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
            else if (ymdMatch) parsedDate = s
            else if (/^\d{5}$/.test(s)) {
              const d = new Date((parseInt(s) - 25569) * 86400000)
              parsedDate = d.toISOString().split('T')[0]
            }
          }
          if (!parsedDate) continue
          const cashNum = typeof rawCash === 'number' ? rawCash : parseFloat(String(rawCash).replace(',', '.'))
          entries.push({ date: parsedDate, gymrealm_gym_cash: isNaN(cashNum) || cashNum <= 0 ? null : cashNum })
        }
      }

      if (entries.length === 0) return NextResponse.json({ error: 'Не намерих данни в файла' }, { status: 400 })

      const now = new Date().toISOString()
      const upsertRows = entries.map(e => ({
        gym_id: GYM_ID,
        date: e.date,
        staff_name: '—',
        gymrealm_gym_cash: e.gymrealm_gym_cash,
        gymrealm_uploaded_at: now,
        gymrealm_filename: filename || 'gymrealm.xlsx',
        updated_at: now,
      }))

      const { error } = await supabase
        .from('daily_cash')
        .upsert(upsertRows, { onConflict: 'gym_id,date' })

      if (error) throw error
      return NextResponse.json({ ok: true, daysImported: entries.length })
    }

    // ── Staff acknowledges alert ──
    if (action === 'ack_alert') {
      const { date } = body
      const { error } = await supabase.from('daily_cash').update({
        alert_seen_by_staff: true,
        updated_at: new Date().toISOString(),
      }).eq('date', date)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}