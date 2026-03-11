# PT Statistics Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the PT Statistics admin tab with monthly navigation, trend indicators, conversion KPI, source distribution, and a 6-month summary table.

**Architecture:** Extend the existing `/api/pt?type=kpi` endpoint to accept `month=YYYY-MM` or `year=YYYY` params and return inquiries + prev-period data. Rewrite `PTAdminKPI` component to use month/year navigation state instead of the current period toggle.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase (via supabaseAdmin)

**Spec:** `docs/superpowers/specs/2026-03-11-pt-stats-redesign.md`

---

## Files

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/api/pt/route.ts` | Extend `type=kpi` handler: month/year params, inquiries, prev-period, monthly_summary |
| Modify | `app/(dashboard)/pt/components/PTAdminKPI.tsx` | Full redesign: month navigator, trends, conversion card, source bars, 6-month table |

---

## Chunk 1: API Extension

### Task 1: Extend `/api/pt?type=kpi` endpoint

**Files:**
- Modify: `app/api/pt/route.ts` (lines 98–124, the `type === 'kpi'` block)

**Context:**
- Currently accepts `period=month|year`, returns `sessions`, `clients`, `packages`
- Need to also accept `month=YYYY-MM` (specific month) and `year=YYYY` (full year)
- Need to return `inquiries` for period and previous period
- Need to return `monthly_summary` array (last 6 months) for the table

**New param logic:**
```
?type=kpi&month=2026-03   → current=March, prev=February
?type=kpi&year=2026       → current=Jan–Dec 2026, prev=Jan–Dec 2025
?type=kpi&period=month    → existing behaviour (current month), kept for compat
?type=kpi&period=year     → existing behaviour (current year), kept for compat
```

- [ ] **Step 1: Replace the `type === 'kpi'` block in `app/api/pt/route.ts`**

Find the block starting at `if (type === 'kpi') {` (line 99) and replace it entirely with the following:

```typescript
// ── KPI stats for admin ──
if (type === 'kpi') {
  const now = new Date()

  // Determine current period bounds
  let start: string, end: string
  let prevStart: string, prevEnd: string

  const monthParam = searchParams.get('month') // YYYY-MM
  const yearParam = searchParams.get('year')   // YYYY
  const period = searchParams.get('period')    // legacy: 'month' | 'year'

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
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

  // Fetch current period data
  const [sessionsRes, clientsRes, packagesRes, inquiriesRes] = await Promise.all([
    supabase.from('pt_sessions')
      .select('id, status, instructor_id, client_id, duration_minutes, instructor:employees!pt_sessions_instructor_id_fkey(name), client:pt_clients(name)')
      .eq('gym_id', GYM_ID).gte('scheduled_at', start).lte('scheduled_at', end),
    supabase.from('pt_clients').select('id, instructor_id, active, created_at').eq('gym_id', GYM_ID),
    supabase.from('pt_packages').select('id, instructor_id, client_id, total_sessions, used_sessions, price_total, active, expires_at, purchased_at, pt_clients(name)').eq('gym_id', GYM_ID).gte('purchased_at', start).lte('purchased_at', end),
    supabase.from('pt_inquiries').select('id, outcome, source, created_at').eq('gym_id', GYM_ID).gte('created_at', start).lte('created_at', end),
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
  const monthlySummary: Array<{ month: string; inquiries: number; won: number; lost: number; revenue: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const [mInq, mPkg] = await Promise.all([
      supabase.from('pt_inquiries').select('id, outcome').eq('gym_id', GYM_ID).gte('created_at', mStart).lte('created_at', mEnd),
      supabase.from('pt_packages').select('price_total').eq('gym_id', GYM_ID).gte('purchased_at', mStart).lte('purchased_at', mEnd),
    ])
    const inqData = mInq.data || []
    const pkgData = mPkg.data || []
    monthlySummary.push({
      month: monthKey,
      inquiries: inqData.length,
      won: inqData.filter(i => i.outcome === 'won').length,
      lost: inqData.filter(i => i.outcome === 'lost').length,
      revenue: pkgData.reduce((a, p) => a + (p.price_total || 0), 0),
    })
  }

  // All packages for client counts (no date filter — for active client tracking)
  const allPackagesRes = await supabase
    .from('pt_packages')
    .select('id, instructor_id, client_id, total_sessions, used_sessions, price_total, active, expires_at, purchased_at, pt_clients(name)')
    .eq('gym_id', GYM_ID)

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Manual API test in browser console**

Start dev server (`npm run dev`), then in browser console:
```js
fetch('/api/pt?type=kpi&month=2026-03').then(r=>r.json()).then(d=>console.log(Object.keys(d), d.inquiries?.length, d.monthly_summary?.length))
```
Expected: keys include `inquiries`, `prev_sessions`, `monthly_summary`; `monthly_summary.length` = 6.

- [ ] **Step 4: Commit**

```bash
git add app/api/pt/route.ts
git commit -m "feat(pt): extend kpi API with month/year nav, inquiries, trends, monthly_summary"
```

---

## Chunk 2: PTAdminKPI Component Redesign

### Task 2: Replace period state with month/year navigation

**Files:**
- Modify: `app/(dashboard)/pt/components/PTAdminKPI.tsx`

**Context:**
- Current state: `period: 'month' | 'year'` + a simple toggle
- New state: `viewYear: number`, `viewMonth: number | null` (null = year view)
- Navigation: ‹ › change month (or year when in year view); pill "2026" toggles year view

- [ ] **Step 1: Replace state and fetch logic at the top of `PTAdminKPI`**

Replace the existing interfaces and component state/useEffect block (roughly lines 1–41) with:

```typescript
// app/(dashboard)/pt/components/PTAdminKPI.tsx
'use client'

import { useState, useEffect } from 'react'

interface KPISession {
  id: string; status: string; instructor_id: string; duration_minutes: number
  client_id: string
  instructor: { name: string } | null
  client: { name: string } | null
}
interface KPIClient { id: string; instructor_id: string; active: boolean; created_at: string }
interface KPIPackage {
  id: string; instructor_id: string; client_id: string
  total_sessions: number; used_sessions: number
  price_total: number | null; active: boolean; expires_at: string | null
  client?: { name: string } | null
}
interface KPIInquiry { id: string; outcome: 'won' | 'lost' | null; source: string | null }
interface PrevSession { id: string; status: string; duration_minutes: number }
interface PrevPackage { id: string; price_total: number | null }
interface PrevInquiry { id: string; outcome: 'won' | 'lost' | null }
interface MonthlySummary { month: string; inquiries: number; won: number; lost: number; revenue: number }

interface Props { selectedInstructor: string }

const MONTH_NAMES_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

export default function PTAdminKPI({ selectedInstructor }: Props) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number | null>(now.getMonth()) // 0-based; null = year view

  const [sessions, setSessions] = useState<KPISession[]>([])
  const [clients, setClients] = useState<KPIClient[]>([])
  const [packages, setPackages] = useState<KPIPackage[]>([])
  const [inquiries, setInquiries] = useState<KPIInquiry[]>([])
  const [prevSessions, setPrevSessions] = useState<PrevSession[]>([])
  const [prevPackages, setPrevPackages] = useState<PrevPackage[]>([])
  const [prevInquiries, setPrevInquiries] = useState<PrevInquiry[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
  const [periodPackages, setPeriodPackages] = useState<KPIPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpiringClients, setShowExpiringClients] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ type: 'kpi' })
    if (viewMonth !== null) {
      params.set('month', `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`)
    } else {
      params.set('year', String(viewYear))
    }
    fetch(`/api/pt?${params}`)
      .then(r => r.json())
      .then(data => {
        setSessions(data.sessions || [])
        setClients(data.clients || [])
        setPackages(data.packages || [])
        setPeriodPackages(data.period_packages || [])
        setInquiries(data.inquiries || [])
        setPrevSessions(data.prev_sessions || [])
        setPrevPackages(data.prev_packages || [])
        setPrevInquiries(data.prev_inquiries || [])
        setMonthlySummary(data.monthly_summary || [])
        setLoading(false)
      })
  }, [viewYear, viewMonth])

  // Navigation
  function goBack() {
    if (viewMonth === null) { setViewYear(y => y - 1) }
    else if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else { setViewMonth(m => (m as number) - 1) }
  }
  function goForward() {
    const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear()
    const isCurrentYear = viewMonth === null && viewYear === now.getFullYear()
    if (isCurrentMonth || isCurrentYear) return
    if (viewMonth === null) { setViewYear(y => y + 1) }
    else if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else { setViewMonth(m => (m as number) + 1) }
  }
  // Fix: capture current viewMonth before the async state update to avoid stale closure bug.
  function toggleYearView() {
    const enteringYearView = viewMonth !== null
    setViewMonth(enteringYearView ? null : now.getMonth())
    if (!enteringYearView) setViewYear(now.getFullYear()) // returning to month view: reset to current year
  }

  const isAtPresent = viewMonth !== null
    ? (viewMonth === now.getMonth() && viewYear === now.getFullYear())
    : viewYear === now.getFullYear()

  const navLabel = viewMonth !== null
    ? `${MONTH_NAMES_BG[viewMonth]} ${viewYear}`
    : `${viewYear}`
```

- [ ] **Step 2: Update aggregations to use new state**

After the navigation section, replace the filtering/aggregation block (currently lines 43–94) with:

```typescript
  // Filter by instructor if selected
  const filteredSessions = selectedInstructor !== 'all'
    ? sessions.filter(s => s.instructor_id === selectedInstructor)
    : sessions
  const filteredClients = selectedInstructor !== 'all'
    ? clients.filter(c => c.instructor_id === selectedInstructor)
    : clients
  const filteredPackages = selectedInstructor !== 'all'
    ? packages.filter(p => p.instructor_id === selectedInstructor)
    : packages

  // Current period aggregations
  const completed = filteredSessions.filter(s => s.status === 'completed').length
  const scheduled = filteredSessions.filter(s => s.status === 'scheduled').length
  const noShows = filteredSessions.filter(s => s.status === 'no_show').length
  const cancelledLate = filteredSessions.filter(s => s.status === 'cancelled_late').length
  const totalHours = filteredSessions.filter(s => s.status === 'completed').reduce((a, s) => a + s.duration_minutes / 60, 0)
  const activeClients = filteredClients.filter(c => c.active).length
  const revenue = periodPackages
    .filter(p => selectedInstructor === 'all' || p.instructor_id === selectedInstructor)
    .reduce((a, p) => a + (p.price_total || 0), 0)
  const noShowRate = filteredSessions.length > 0 ? ((noShows / filteredSessions.length) * 100).toFixed(1) : '0'

  // Trend helpers
  function trendPct(current: number, prev: number): string | null {
    if (prev === 0) return null
    const pct = Math.round(((current - prev) / prev) * 100)
    if (pct === 0) return null
    return pct > 0 ? `↑ +${pct}%` : `↓ ${Math.abs(pct)}%`
  }
  function trendPositive(current: number, prev: number): boolean { return current >= prev }

  const prevCompleted = prevSessions.filter(s => s.status === 'completed').length
  const prevNoShows = prevSessions.filter(s => s.status === 'no_show').length
  const prevRevenue = prevPackages.reduce((a, p) => a + (p.price_total || 0), 0)
  const prevActiveInquiries = prevInquiries.length // used for inquiry trend

  // Conversion from inquiries
  const wonInquiries = inquiries.filter(i => i.outcome === 'won').length
  const lostInquiries = inquiries.filter(i => i.outcome === 'lost').length
  const activeInquiries = inquiries.filter(i => i.outcome === null).length
  const closedInquiries = wonInquiries + lostInquiries
  const conversionPct = closedInquiries > 0 ? Math.round((wonInquiries / closedInquiries) * 100) : 0
  const prevWon = prevInquiries.filter(i => i.outcome === 'won').length
  const prevClosed = prevInquiries.filter(i => i.outcome !== null).length
  const prevConvPct = prevClosed > 0 ? Math.round((prevWon / prevClosed) * 100) : 0

  // Source distribution
  const sourceMap: Record<string, number> = {}
  inquiries.forEach(i => { if (i.source) sourceMap[i.source] = (sourceMap[i.source] || 0) + 1 })
  const totalWithSource = Object.values(sourceMap).reduce((a, v) => a + v, 0)
  const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
    facebook:  { label: '📘 Фейсбук',  color: '#4267B2' },
    instagram: { label: '📸 Инстаграм', color: '#E1306C' },
    google:    { label: '🔍 Гугъл',     color: '#fbbf24' },
    friend:    { label: '👥 Приятел',   color: '#34d399' },
    nearby:    { label: '📍 Наблизо',   color: '#a78bfa' },
  }
  const sortedSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])

  // Renewal & expiring (unchanged)
  const renewalNeeded = filteredPackages.filter(p => p.active && (p.total_sessions - p.used_sessions) <= 2).length
  const expiringPackages = filteredPackages.filter(p =>
    p.active && p.expires_at && new Date(p.expires_at) < new Date(Date.now() + 14 * 86400000)
  )

  // Per-instructor breakdown (unchanged logic)
  const instructorMap: Record<string, { name: string; completed: number; noShows: number; clients: Set<string>; revenue: number }> = {}
  sessions.forEach(s => {
    const name = s.instructor?.name || s.instructor_id
    if (!instructorMap[s.instructor_id]) instructorMap[s.instructor_id] = { name, completed: 0, noShows: 0, clients: new Set(), revenue: 0 }
    if (s.status === 'completed') instructorMap[s.instructor_id].completed++
    if (s.status === 'no_show') instructorMap[s.instructor_id].noShows++
  })
  packages.forEach(p => {
    if (instructorMap[p.instructor_id]) instructorMap[p.instructor_id].revenue += p.price_total || 0
  })
  clients.forEach(c => {
    if (c.active && instructorMap[c.instructor_id]) instructorMap[c.instructor_id].clients.add(c.id)
  })
  const instructorStats = Object.values(instructorMap).sort((a, b) => b.revenue - a.revenue)

  // Clients with sessions this period
  const clientsWithSessions = (() => {
    const map: Record<string, { name: string; count: number; instructorName: string }> = {}
    filteredSessions.filter(s => s.status === 'completed').forEach(s => {
      if (!map[s.client_id]) map[s.client_id] = { name: s.client?.name || '—', count: 0, instructorName: s.instructor?.name || '—' }
      map[s.client_id].count++
    })
    return Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count)
  })()
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from the changed file.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/pt/components/PTAdminKPI.tsx
git commit -m "feat(pt): replace period toggle with month/year navigation state + trend aggregations"
```

---

### Task 3: Rewrite the JSX — navigation bar + KPI cards with trends

**Files:**
- Modify: `app/(dashboard)/pt/components/PTAdminKPI.tsx` (the `return (...)` block)

- [ ] **Step 1: Replace the loading guard and the `return (` opening section**

Replace from `if (loading) return (` to the closing `</div>` of the period toggle block (currently lines 120–138) with:

```typescript
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Month / Year navigation ── */}
      <div className="flex items-center gap-2">
        <button onClick={goBack}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white text-sm transition-all">
          ‹
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg bg-white/[0.03] border border-white/[0.07] px-3">
          <span className="text-sm font-semibold text-white/80">{navLabel}</span>
        </div>
        <button onClick={goForward} disabled={isAtPresent}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          ›
        </button>
        <button onClick={toggleYearView}
          className={`px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
            viewMonth === null
              ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
              : 'bg-white/[0.03] text-white/50 border-white/[0.08] hover:text-white/70'
          }`}>
          {viewYear}
        </button>
      </div>

      {/* ── KPI cards with trends ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Проведени', value: completed,
            sub: `${totalHours.toFixed(0)}ч общо`, color: 'text-emerald-400',
            trend: trendPct(completed, prevCompleted), trendUp: trendPositive(completed, prevCompleted),
          },
          {
            label: 'Приходи', value: `€${revenue.toFixed(0)}`,
            sub: `${periodPackages.length} пакета`, color: 'text-emerald-400',
            trend: trendPct(revenue, prevRevenue), trendUp: trendPositive(revenue, prevRevenue),
          },
          {
            label: 'Неявявания', value: noShows,
            sub: `${noShowRate}% от всички`, color: noShows > 0 ? 'text-red-400' : 'text-white/40',
            trend: trendPct(noShows, prevNoShows), trendUp: noShows <= prevNoShows,
          },
          {
            label: 'Активни клиенти', value: activeClients,
            sub: 'общо', color: 'text-sky-400',
            trend: null, trendUp: true,
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[11px] text-white/30 mt-0.5">{kpi.sub}</div>
            {kpi.trend && (
              <div className={`text-[10px] font-semibold mt-1 ${kpi.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.trend}
              </div>
            )}
          </div>
        ))}
      </div>
```

- [ ] **Step 2: Add Conversion card (Спечелени клиенти) after KPI cards**

Immediately after the KPI cards closing `</div>`, add:

```typescript
      {/* ── Conversion card (Спечелени клиенти) ── */}
      {inquiries.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Спечелени клиенти</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{conversionPct}%</span>
                <span className="text-[11px] text-white/35">{wonInquiries} от {closedInquiries} запитвания</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-emerald-400 font-semibold">{wonInquiries}</span>
                  <span className="text-white/35">спечелени</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  <span className="text-red-400 font-semibold">{lostInquiries}</span>
                  <span className="text-white/35">загубени</span>
                </span>
                {activeInquiries > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    <span className="text-amber-400 font-semibold">{activeInquiries}</span>
                    <span className="text-white/35">активни</span>
                  </span>
                )}
              </div>
            </div>
            {prevClosed > 0 && trendPct(conversionPct, prevConvPct) && (
              <div className={`text-xs font-semibold shrink-0 ${trendPositive(conversionPct, prevConvPct) ? 'text-emerald-400' : 'text-red-400'}`}>
                {trendPct(conversionPct, prevConvPct)}
              </div>
            )}
          </div>
          {closedInquiries > 0 && (
            <div className="mt-3 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${conversionPct}%` }}
              />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Add Source distribution section**

After the conversion card, add:

```typescript
      {/* ── Source distribution ── */}
      {sortedSources.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Откъде разбраха за нас</div>
          <div className="space-y-2.5">
            {sortedSources.map(([key, count]) => {
              const cfg = SOURCE_CONFIG[key] || { label: key, color: '#ffffff' }
              const pct = totalWithSource > 0 ? Math.round((count / totalWithSource) * 100) : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-[11px] text-white/55 w-[90px] shrink-0">{cfg.label}</span>
                  <div className="flex-1 h-[5px] bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: cfg.color, opacity: 0.75 }}
                    />
                  </div>
                  <span className="text-[11px] text-white/40 w-8 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add "Последни 6 месеца" table (month view only)**

After source distribution, add:

```typescript
      {/* ── Последни 6 месеца (month view only) ── */}
      {viewMonth !== null && monthlySummary.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Последни 6 месеца</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Месец', 'Запитвания', 'Спечелени', 'Конв.', 'Приходи'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...monthlySummary].reverse().map(row => {
                const [y, m] = row.month.split('-').map(Number)
                const isCurrent = y === viewYear && (m - 1) === viewMonth
                const rowClosed = row.won + row.lost
                const rowConv = rowClosed > 0 ? Math.round((row.won / rowClosed) * 100) : 0
                return (
                  <tr key={row.month} className={`border-b border-white/[0.04] last:border-0 ${isCurrent ? '' : 'opacity-60'}`}>
                    <td className={`px-4 py-2.5 text-xs ${isCurrent ? 'text-white font-semibold' : 'text-white/70'}`}>
                      {MONTH_NAMES_BG[m - 1].slice(0, 3)} {y}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/60">{row.inquiries}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-emerald-400">{row.won}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-amber-400">{rowConv}%</td>
                    <td className="px-4 py-2.5 text-xs text-emerald-400">€{row.revenue.toFixed(0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
```

- [ ] **Step 5: Keep the rest of the existing JSX, with one fix in Revenue summary**

The remaining sections (Alerts row, Per-instructor breakdown, Revenue summary, Clients with sessions) stay **mostly unchanged**.

**One required fix in Revenue summary** — the existing text references the deleted `period` variable:
```typescript
// OLD (will not compile — `period` no longer exists):
Приходи от пакети — {period === 'month' ? 'месец' : 'година'}

// NEW:
Приходи от пакети — {viewMonth !== null ? 'месец' : 'година'}
```

Also update the Revenue summary subtitle to use `periodPackages` count (not all packages):
```typescript
// OLD:
<div className="text-[11px] text-white/30 mt-1">{filteredPackages.length} продадени пакета</div>

// NEW:
<div className="text-[11px] text-white/30 mt-1">{periodPackages.filter(p => selectedInstructor === 'all' || p.instructor_id === selectedInstructor).length} продадени пакета</div>
```

Ensure the component closes correctly with:
```typescript
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 7: Manual verification in browser**

1. Open `/pt` tab → Статистика
2. Verify: month nav bar shows current month name + year
3. Click ‹ — goes to previous month, data reloads
4. Click year pill (e.g. "2026") — nav label changes to "2026", pill highlights amber
5. KPI cards show trends (↑ / ↓) where prev period has data
6. Conversion card appears (if inquiries exist for period)
7. Source bars appear (if inquiries have source set)
8. "Последни 6 месеца" table visible in month view, hidden in year view

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/pt/components/PTAdminKPI.tsx
git commit -m "feat(pt): redesign Statistics tab — month nav, trends, conversion, source, 6-month table"
```

---

## Final Checklist

- [ ] API returns `inquiries`, `prev_*`, `monthly_summary` for both month and year params
- [ ] Month navigation: ‹ Март 2026 › works, can't go past current month
- [ ] Year pill toggles year view; navigation changes year in year mode
- [ ] All 4 KPI cards show trend badge where applicable
- [ ] Conversion card shows %, won/lost/active counts, progress bar, trend
- [ ] Source bars render for each source with count > 0
- [ ] "Последни 6 месеца" table visible in month view, hidden in year view
- [ ] TypeScript strict — no `any`, no new type errors
- [ ] No N+1 queries (monthly_summary loop is 6 iterations, acceptable)
