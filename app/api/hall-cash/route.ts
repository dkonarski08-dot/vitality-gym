// app/api/hall-cash/route.ts
// Vitality Hall — Daily Cash API
//
// Data flow:
//   Receptionist → cash_turnover (manual cash), system_turnover (manual system)
//   Admin        → admin_cash_counted (physical count), gymrealm_cash (import only)
//   GymRealm import ONLY writes gymrealm_cash — never touches receptionist fields
//
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ExcelJS from 'exceljs'
import { GYM_ID } from '@/lib/constants'

// ── GET ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') || 'receptionist'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const today = new Date().toISOString().split('T')[0]

    // W10: non-admin only gets today + yesterday (same as cash route)
    if (role !== 'admin') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const { data, error } = await supabaseAdmin
        .from('hall_daily_cash')
        .select('id, date, staff_name, cash_turnover, system_turnover, notes, alert_physical_diff, alert_system_diff, alert_seen_by_staff, created_at')
        .eq('gym_id', GYM_ID)
        .in('date', [today, yesterdayStr])
        .order('date', { ascending: false })
      if (error) throw error
      return NextResponse.json({ records: data || [] })
    }

    let query = supabaseAdmin
      .from('hall_daily_cash')
      .select('*')
      .eq('gym_id', GYM_ID)
      .order('date', { ascending: false })

    if (from && to) {
      query = query.gte('date', from).lte('date', to)
    } else {
      // Fallback: current month
      const now = new Date()
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('date', start).lte('date', end)
    }

    const { data: records, error } = await query
    if (error) throw error
    return NextResponse.json({ records: records || [] })
  } catch (err) {
    console.error('[hall-cash GET]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// ── POST ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {

      // Receptionist saves their manual entry
      case 'staff_save': {
        const { date, staff_name, cash_turnover, system_turnover, notes } = body

        const cashVal = cash_turnover !== '' && cash_turnover != null ? parseFloat(cash_turnover) : null
        const sysVal = system_turnover !== '' && system_turnover != null ? parseFloat(system_turnover) : null

        const { error } = await supabaseAdmin
          .from('hall_daily_cash')
          .upsert({
            gym_id: GYM_ID,
            date,
            staff_name: staff_name || '—',
            cash_turnover: cashVal,
            system_turnover: sysVal,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'gym_id,date' })

        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // Admin physical count — only writes admin_cash_counted, checks diff vs receptionist cash
      case 'admin_count': {
        const { date, admin_cash_counted, admin_counted_by } = body

        const adminVal = parseFloat(admin_cash_counted)
        if (isNaN(adminVal)) throw new Error('Невалидна сума')

        // Check diff against receptionist cash_turnover
        const { data: existing } = await supabaseAdmin
          .from('hall_daily_cash')
          .select('cash_turnover')
          .eq('gym_id', GYM_ID)
          .eq('date', date)
          .maybeSingle()

        const staffCash = existing?.cash_turnover ?? null
        const alertPhysical = staffCash !== null && Math.abs(adminVal - staffCash) > 5

        const { error } = await supabaseAdmin
          .from('hall_daily_cash')
          .upsert({
            gym_id: GYM_ID,
            date,
            admin_cash_counted: adminVal,
            admin_counted_by: admin_counted_by || 'Admin',
            admin_counted_at: new Date().toISOString(),
            alert_physical_diff: alertPhysical,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'gym_id,date' })

        if (error) throw error
        return NextResponse.json({ ok: true, alertPhysical })
      }

      // GymRealm import — reads ALL days from the report, writes gymrealm_cash per day
      // Never touches cash_turnover or system_turnover
      case 'gymrealm_import': {
        const { fileBase64, filename } = body
        if (!fileBase64) throw new Error('Няма файл')

        const buffer = Buffer.from(fileBase64, 'base64')
        const wb = new ExcelJS.Workbook()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await wb.xlsx.load(buffer as any)
        const ws = wb.worksheets[0]
        const allRows: unknown[][] = []
        ws.eachRow((row) => { allRows.push((row.values as unknown[]).slice(1)) })
        const headers = (allRows[0] as string[]).map(h => String(h ?? ''))
        const rows: Record<string, unknown>[] = allRows.slice(1).map(rowVals => {
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => { obj[h] = (rowVals as unknown[])[i] ?? '' })
          return obj
        })

        // Find date column and cash column from headers
        const dateKey = headers.find(h => {
          const l = h.toLowerCase()
          return l.includes('дата') || l.includes('date') || l.includes('ден')
        })

        const cashKey = headers.find(h => {
          const l = h.toLowerCase()
          return l.includes('в брой') || l === 'cash' || l.includes('брой')
        })

        type DayResult = { date: string; cashAmount: number | null; raw: string }
        const results: DayResult[] = []
        const upserts: Record<string, unknown>[] = []

        if (dateKey && cashKey) {
          // Structured report: one row per day with date + cash columns
          for (const row of rows) {
            const rawDate = row[dateKey]
            const rawCash = row[cashKey]

            // Parse date
            let parsedDate: string | null = null
            if (rawDate instanceof Date) {
              parsedDate = rawDate.toISOString().split('T')[0]
            } else {
              const s = String(rawDate).trim()
              // Try DD.MM.YYYY or YYYY-MM-DD
              const dmyMatch = s.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/)
              const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
              if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
              else if (ymdMatch) parsedDate = s
              // Excel serial number
              else if (/^\d{5}$/.test(s)) {
                const d = new Date((parseInt(s) - 25569) * 86400000)
                parsedDate = d.toISOString().split('T')[0]
              }
            }

            if (!parsedDate) continue

            const cashNum = parseFloat(String(rawCash).replace(',', '.').replace(/\s/g, ''))
            const cashAmount = isNaN(cashNum) || cashNum <= 0 ? null : cashNum

            results.push({ date: parsedDate, cashAmount, raw: String(rawCash) })
            upserts.push({
              gym_id: GYM_ID,
              date: parsedDate,
              gymrealm_cash: cashAmount,
              gymrealm_filename: filename || 'gymrealm.xlsx',
              gymrealm_uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } else {
          // Fallback: scan all rows for (date-like, cash-like) value pairs
          for (const row of rows) {
            let parsedDate: string | null = null
            let cashAmount: number | null = null

            for (const [key, val] of Object.entries(row)) {
              const s = String(val).trim()
              if (!parsedDate) {
                const dmyMatch = s.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/)
                const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
                if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
                else if (ymdMatch) parsedDate = s
              }
              const kl = key.toLowerCase()
              if (!cashAmount && (kl.includes('брой') || kl.includes('cash'))) {
                const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
                if (!isNaN(n) && n > 0) cashAmount = n
              }
            }

            if (!parsedDate) continue
            results.push({ date: parsedDate, cashAmount, raw: '' })
            upserts.push({
              gym_id: GYM_ID,
              date: parsedDate,
              gymrealm_cash: cashAmount,
              gymrealm_filename: filename || 'gymrealm.xlsx',
              gymrealm_uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        }

        if (upserts.length === 0) {
          return NextResponse.json({
            ok: false,
            error: 'Не бяха намерени дати в файла. Провери формата.',
            rows: rows.length,
            headers,
          }, { status: 422 })
        }

        // Batch upsert all days
        const { error } = await supabaseAdmin
          .from('hall_daily_cash')
          .upsert(upserts, { onConflict: 'gym_id,date' })

        if (error) throw error
        return NextResponse.json({ ok: true, daysImported: upserts.length, results, rows: rows.length })
      }

      case 'ack_alert': {
        const { date } = body
        const { error } = await supabaseAdmin
          .from('hall_daily_cash')
          .update({ alert_seen_by_staff: true, updated_at: new Date().toISOString() })
          .eq('gym_id', GYM_ID)
          .eq('date', date)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[hall-cash POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
