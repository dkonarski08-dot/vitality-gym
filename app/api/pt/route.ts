// app/api/pt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { getTodayISO } from '@/lib/formatters'
import { requireRole } from '@/lib/requireRole'

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const instructorId = searchParams.get('instructor_id')
    const month = searchParams.get('month') // YYYY-MM

    // ── Instructors list ──
    if (type === 'instructors') {
      const { data } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('active', true)
        .in('role', ['instructor', 'admin'])
        .order('name', { ascending: true })
      return NextResponse.json({ instructors: data || [] })
    }

    // ── Clients (optionally filtered by instructor) ──
    if (type === 'clients') {
      const query = supabase
        .from('pt_clients')
        .select(`
          *,
          instructor:employees!pt_clients_instructor_id_fkey(id, name),
          packages:pt_packages(id, total_sessions, used_sessions, expires_at, active, purchased_at, price_total)
        `)
        .eq('gym_id', GYM_ID)
        .order('name', { ascending: true })
      if (instructorId) query.eq('instructor_id', instructorId)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ clients: data || [] })
    }

    // ── Sessions for a month ──
    if (type === 'sessions' && month) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1).toISOString()
      const end = new Date(y, m, 0, 23, 59, 59).toISOString()
      const query = supabase
        .from('pt_sessions')
        .select(`
          *,
          client:pt_clients(id, name, phone, goal),
          instructor:employees!pt_sessions_instructor_id_fkey(id, name)
        `)
        .eq('gym_id', GYM_ID)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true })
      if (instructorId) query.eq('instructor_id', instructorId)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ sessions: data || [] })
    }

    // ── Sessions for a week ──
    if (type === 'sessions_week') {
      const weekStart = searchParams.get('week_start') // YYYY-MM-DD
      if (!weekStart) return NextResponse.json({ sessions: [] })
      const start = new Date(weekStart + 'T00:00:00').toISOString()
      const end = new Date(new Date(weekStart + 'T00:00:00').getTime() + 7 * 86400000).toISOString()
      const query = supabase
        .from('pt_sessions')
        .select(`*, client:pt_clients(id, name, phone), instructor:employees!pt_sessions_instructor_id_fkey(id, name)`)
        .eq('gym_id', GYM_ID)
        .gte('scheduled_at', start)
        .lt('scheduled_at', end)
        .order('scheduled_at', { ascending: true })
      if (instructorId) query.eq('instructor_id', instructorId)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ sessions: data || [] })
    }

    // ── Single client detail ──
    const clientId = searchParams.get('client_id')
    if (clientId) {
      const [clientRes, sessionsRes, packagesRes] = await Promise.all([
        supabase.from('pt_clients').select('*, instructor:employees!pt_clients_instructor_id_fkey(id, name)').eq('id', clientId).single(),
        supabase.from('pt_sessions').select('*').eq('client_id', clientId).order('scheduled_at', { ascending: false }).limit(100),
        supabase.from('pt_packages').select('*').eq('client_id', clientId).order('purchased_at', { ascending: false }),
      ])
      return NextResponse.json({
        client: clientRes.data,
        sessions: sessionsRes.data || [],
        packages: packagesRes.data || [],
      })
    }

    // ── KPI stats for admin ──
    if (type === 'kpi') {
      const now = new Date()

      // Determine current period bounds
      let start: string, end: string
      let prevStart: string, prevEnd: string

      const yearParam = searchParams.get('year')   // YYYY
      const period = searchParams.get('period')    // legacy: 'month' | 'year'

      if (month) {
        const [y, m] = month.split('-').map(Number)
        start = new Date(y, m - 1, 1).toISOString()
        end = new Date(y, m, 0, 23, 59, 59).toISOString()
        // prev: one month back
        const prevDate = new Date(y, m - 2, 1)
        prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1).toISOString()
        prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0, 23, 59, 59).toISOString()
      } else if (yearParam) {
        const y = parseInt(yearParam)
        start = new Date(y, 0, 1).toISOString()
        end = new Date(y, 11, 31, 23, 59, 59).toISOString()
        prevStart = new Date(y - 1, 0, 1).toISOString()
        prevEnd = new Date(y - 1, 11, 31, 23, 59, 59).toISOString()
      } else if (period === 'year') {
        // legacy compat
        start = new Date(now.getFullYear(), 0, 1).toISOString()
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString()
        prevStart = new Date(now.getFullYear() - 1, 0, 1).toISOString()
        prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).toISOString()
      } else {
        // default: current month (legacy month compat)
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1).toISOString()
        prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0, 23, 59, 59).toISOString()
      }

      // Fetch current period data (+ all packages in parallel)
      const [sessionsRes, clientsRes, packagesRes, inquiriesRes, allPackagesRes] = await Promise.all([
        supabase.from('pt_sessions')
          .select('id, status, instructor_id, client_id, duration_minutes, instructor:employees!pt_sessions_instructor_id_fkey(name), client:pt_clients(name)')
          .eq('gym_id', GYM_ID).gte('scheduled_at', start).lte('scheduled_at', end),
        supabase.from('pt_clients').select('id, instructor_id, active, created_at').eq('gym_id', GYM_ID),
        supabase.from('pt_packages').select('id, instructor_id, client_id, total_sessions, used_sessions, price_total, active, expires_at, purchased_at, pt_clients(name)').eq('gym_id', GYM_ID).gte('purchased_at', start).lte('purchased_at', end),
        supabase.from('pt_inquiries').select('id, outcome, source, created_at').eq('gym_id', GYM_ID).gte('created_at', start).lte('created_at', end),
        supabase.from('pt_packages')
          .select('id, instructor_id, client_id, total_sessions, used_sessions, price_total, active, expires_at, purchased_at, pt_clients(name)')
          .eq('gym_id', GYM_ID),
      ])

      // Fetch previous period data for trends (sessions + packages + inquiries only)
      const [prevSessionsRes, prevPackagesRes, prevInquiriesRes] = await Promise.all([
        supabase.from('pt_sessions')
          .select('id, status, duration_minutes')
          .eq('gym_id', GYM_ID).gte('scheduled_at', prevStart).lte('scheduled_at', prevEnd),
        supabase.from('pt_packages')
          .select('id, price_total')
          .eq('gym_id', GYM_ID).gte('purchased_at', prevStart).lte('purchased_at', prevEnd),
        supabase.from('pt_inquiries')
          .select('id, outcome')
          .eq('gym_id', GYM_ID).gte('created_at', prevStart).lte('created_at', prevEnd),
      ])

      // Monthly summary: last 6 months (always calendar months, independent of selected period)
      // Includes `lost` count so the table can compute won/(won+lost) conversion correctly.
      // All 12 queries (2 per month × 6 months) execute in parallel — no N+1
      const monthRanges = Array.from({ length: 6 }, (_, idx) => {
        const i = 5 - idx
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        return {
          monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          mStart: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
          mEnd: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
        }
      })

      const monthlyResults = await Promise.all(
        monthRanges.flatMap(({ mStart, mEnd }) => [
          supabase.from('pt_inquiries').select('id, outcome').eq('gym_id', GYM_ID).gte('created_at', mStart).lte('created_at', mEnd),
          supabase.from('pt_packages').select('price_total').eq('gym_id', GYM_ID).gte('purchased_at', mStart).lte('purchased_at', mEnd),
        ])
      )

      const monthlySummary: Array<{ month: string; inquiries: number; won: number; lost: number; revenue: number }> = monthRanges.map(({ monthKey }, idx) => {
        const inqData = (monthlyResults[idx * 2].data || []) as Array<{ id: string; outcome: string }>
        const pkgData = (monthlyResults[idx * 2 + 1].data || []) as Array<{ price_total: number | null }>
        return {
          month: monthKey,
          inquiries: inqData.length,
          won: inqData.filter(i => i.outcome === 'won').length,
          lost: inqData.filter(i => i.outcome === 'lost').length,
          revenue: pkgData.reduce((a, p) => a + (p.price_total || 0), 0),
        }
      })

      return NextResponse.json({
        sessions: sessionsRes.data || [],
        clients: clientsRes.data || [],
        packages: allPackagesRes.data || [],
        period_packages: packagesRes.data || [],
        inquiries: inquiriesRes.data || [],
        prev_sessions: prevSessionsRes.data || [],
        prev_packages: prevPackagesRes.data || [],
        prev_inquiries: prevInquiriesRes.data || [],
        monthly_summary: monthlySummary,
        period_start: start,
        period_end: end,
      })
    }

    // ── Inquiries list ──
    if (type === 'inquiries') {
      const statusFilter = searchParams.get('status') // 'pending' | 'done' | null = all
      const query = supabase
        .from('pt_inquiries')
        .select('*, assigned:employees!pt_inquiries_assigned_to_fkey(id, name)')
        .eq('gym_id', GYM_ID)
        .order('created_at', { ascending: false })
      if (statusFilter) query.eq('status', statusFilter)
      if (instructorId) query.or(`assigned_to.eq.${instructorId},assigned_to.is.null`)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ inquiries: data || [] })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist', 'instructor')
  if (authError) return authError
  try {
    const body = await req.json()
    const { action } = body

    // ── Add client ──
    if (action === 'add_client') {
      const { instructor_id, name, phone, email, goal, health_notes, preferred_days, preferred_time_slot, source } = body
      if (!instructor_id || !name) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })

      // Phone duplicate check
      if (phone) {
        const { data: existing } = await supabase
          .from('pt_clients')
          .select('id, name')
          .eq('gym_id', GYM_ID)
          .eq('phone', phone.trim())
          .maybeSingle()
        if (existing) {
          return NextResponse.json(
            { error: 'DUPLICATE_PHONE', existingClient: existing },
            { status: 409 }
          )
        }
      }

      const { data, error } = await supabase.from('pt_clients').insert([{
        gym_id: GYM_ID, instructor_id, name, phone, email, goal, health_notes, preferred_days, preferred_time_slot, source
      }]).select().single()
      if (error) throw error
      return NextResponse.json({ success: true, client: data })
    }

    // ── Edit client ──
    if (action === 'edit_client') {
      const { client_id, name, phone, email, goal, health_notes, active, instructor_id, preferred_days, preferred_time_slot, source } = body
      const { error } = await supabase.from('pt_clients')
        .update({ name, phone, email, goal, health_notes, active, instructor_id, preferred_days, preferred_time_slot, source, updated_at: new Date().toISOString() })
        .eq('id', client_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Add package ──
    if (action === 'add_package') {
      const { client_id, instructor_id, total_sessions, price_total, purchased_at, expires_at, notes, starts_on, duration_days } = body
      if (!client_id || !total_sessions) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })
      // DO NOT deactivate previous packages — multiple active packages are allowed
      const { data, error } = await supabase.from('pt_packages').insert([{
        gym_id: GYM_ID, client_id, instructor_id, total_sessions, used_sessions: 0,
        price_total, purchased_at: purchased_at || getTodayISO(),
        expires_at, notes, active: true, starts_on, duration_days
      }]).select().single()
      if (error) throw error
      return NextResponse.json({ success: true, package: data })
    }

    // ── Add single session ──
    if (action === 'add_session') {
      const { instructor_id, client_id, package_id, scheduled_at, duration_minutes,
              session_type, location, notes, created_by, billing_type, session_price } = body
      if (!instructor_id || !client_id || !scheduled_at)
        return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })
      const { data, error } = await supabase.from('pt_sessions').insert([{
        gym_id: GYM_ID, instructor_id, client_id,
        package_id: billing_type === 'package' ? package_id : null,
        scheduled_at, duration_minutes: duration_minutes || 60,
        session_type: session_type || 'personal',
        status: 'scheduled', location, notes, created_by,
        billing_type: billing_type || 'package',
        session_price: billing_type === 'individual' ? (session_price || null) : null,
      }]).select('*, client:pt_clients(id, name), instructor:employees!pt_sessions_instructor_id_fkey(id, name)').single()
      if (error) throw error
      return NextResponse.json({ success: true, session: data })
    }

    // ── Add recurring sessions ──
    if (action === 'add_recurring') {
      const { instructor_id, client_id, package_id, day_of_week, time_of_day,
              duration_minutes, session_type, location, starts_on, ends_on,
              created_by, billing_type, session_price } = body
      const groupId = crypto.randomUUID()
      const rows = []

      // Save template for reference
      await supabase.from('pt_recurrence_templates').insert([{
        gym_id: GYM_ID, instructor_id, client_id, package_id,
        day_of_week, time_of_day, duration_minutes, session_type, location,
        starts_on, ends_on, active: true
      }])

      const start = new Date(starts_on + 'T12:00:00')
      const end = ends_on ? new Date(ends_on + 'T12:00:00') : new Date(start.getTime() + 90 * 86400000)
      const cur = new Date(start)
      // Advance to the first occurrence of the requested weekday
      while (cur.getDay() !== day_of_week) cur.setDate(cur.getDate() + 1)

      while (cur <= end) {
        const [h, m] = (time_of_day as string).split(':').map(Number)
        const sessionDate = new Date(cur)
        sessionDate.setHours(h, m, 0, 0)
        rows.push({
          gym_id: GYM_ID, instructor_id, client_id,
          package_id: billing_type === 'package' ? package_id : null,
          scheduled_at: sessionDate.toISOString(),
          duration_minutes: duration_minutes || 60,
          session_type: session_type || 'personal',
          status: 'scheduled', location, created_by,
          recurrence_group_id: groupId,
          billing_type: billing_type || 'package',
          session_price: billing_type === 'individual' ? (session_price || null) : null,
        })
        cur.setDate(cur.getDate() + 7)
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('pt_sessions').insert(rows)
        if (error) throw error
      }
      return NextResponse.json({ success: true, count: rows.length, group_id: groupId })
    }

    // ── Update session (status, notes, reschedule) ──
    if (action === 'update_session') {
      const { session_id, status, notes, scheduled_at, duration_minutes, location } = body
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status !== undefined) update.status = status
      if (notes !== undefined) update.notes = notes
      if (scheduled_at !== undefined) update.scheduled_at = scheduled_at
      if (duration_minutes !== undefined) update.duration_minutes = duration_minutes
      if (location !== undefined) update.location = location
      if (['cancelled_early', 'cancelled_late', 'no_show'].includes(status ?? '')) {
        update.cancelled_at = new Date().toISOString()
        if (body.cancelled_by) update.cancelled_by = body.cancelled_by
      }

      const { error } = await supabase.from('pt_sessions').update(update).eq('id', session_id)
      if (error) throw error

      return NextResponse.json({ success: true })
    }

    // ── Delete session (admin only) ──
    if (action === 'delete_session') {
      const deleteSessionAuthErr = requireRole(req, 'admin')
      if (deleteSessionAuthErr) return deleteSessionAuthErr
      const { session_id } = body
      const { error } = await supabase.from('pt_sessions').delete().eq('id', session_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Edit package used_sessions (admin only) ──
    if (action === 'edit_package_used') {
      const editPkgAuthErr = requireRole(req, 'admin')
      if (editPkgAuthErr) return editPkgAuthErr
      const { package_id, used_sessions } = body
      if (package_id === undefined || used_sessions === undefined)
        return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })
      const { error } = await supabase.from('pt_packages')
        .update({ used_sessions: Math.max(0, Number(used_sessions)) })
        .eq('id', package_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Edit full package (sessions, price, dates) ──
    if (action === 'edit_package') {
      const editPkgAuthErr = requireRole(req, 'admin')
      if (editPkgAuthErr) return editPkgAuthErr
      const { package_id, total_sessions, price_total, starts_on, duration_days, expires_at, remaining_sessions } = body
      if (!package_id) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (total_sessions !== undefined) update.total_sessions = total_sessions
      if (price_total !== undefined) update.price_total = price_total
      if (starts_on !== undefined) update.starts_on = starts_on
      if (duration_days !== undefined) update.duration_days = duration_days
      if (expires_at !== undefined) update.expires_at = expires_at
      if (remaining_sessions !== undefined && total_sessions !== undefined) {
        update.used_sessions = Math.max(0, total_sessions - remaining_sessions)
      }

      const { error } = await supabase.from('pt_packages').update(update).eq('id', package_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Delete recurring group (from a date onwards) ──
    if (action === 'delete_recurring') {
      const { group_id, from_date } = body
      let query = supabase.from('pt_sessions').delete().eq('recurrence_group_id', group_id).eq('status', 'scheduled')
      if (from_date) query = query.gte('scheduled_at', from_date)
      const { error } = await query
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Add inquiry ──
    if (action === 'add_inquiry') {
      const { name, phone, preferred_days, preferred_time_slot, goal, notes, created_by, assigned_to, source } = body
      if (!name || !phone) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })
      const { data, error } = await supabase.from('pt_inquiries').insert([{
        gym_id: GYM_ID, name, phone, preferred_days, preferred_time_slot, goal, notes, source,
        created_by, assigned_to: assigned_to || null, status: 'pending'
      }]).select().single()
      if (error) throw error
      return NextResponse.json({ success: true, inquiry: data })
    }

    // ── Update inquiry ──
    if (action === 'update_inquiry') {
      const { inquiry_id, status, outcome, lost_reason, notes, assigned_to } = body
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status !== undefined) update.status = status
      if (outcome !== undefined) update.outcome = outcome
      if (lost_reason !== undefined) update.lost_reason = lost_reason
      if (notes !== undefined) update.notes = notes
      if (assigned_to !== undefined) update.assigned_to = assigned_to
      const { error } = await supabase.from('pt_inquiries').update(update).eq('id', inquiry_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Delete inquiry ──
    if (action === 'delete_inquiry') {
      const { inquiry_id } = body
      const { error } = await supabase.from('pt_inquiries').delete().eq('id', inquiry_id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const authErr = requireRole(req, 'admin')
  if (authErr) return authErr
  try {
    const { searchParams } = new URL(req.url)
    const client_id = searchParams.get('client_id')
    if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

    // pt_sessions and pt_inquiries lack ON DELETE CASCADE — delete manually first
    // pt_packages has CASCADE so will be auto-deleted with the client
    await supabase.from('pt_sessions').delete().eq('client_id', client_id).eq('gym_id', GYM_ID)
    await supabase.from('pt_inquiries').delete().eq('client_id', client_id).eq('gym_id', GYM_ID)

    const { error } = await supabase
      .from('pt_clients')
      .delete()
      .eq('id', client_id)
      .eq('gym_id', GYM_ID)

    if (error) return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
