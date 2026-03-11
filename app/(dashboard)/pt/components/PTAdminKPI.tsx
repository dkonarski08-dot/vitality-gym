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
  const [periodPackages, setPeriodPackages] = useState<KPIPackage[]>([])
  const [inquiries, setInquiries] = useState<KPIInquiry[]>([])
  const [prevSessions, setPrevSessions] = useState<PrevSession[]>([])
  const [prevPackages, setPrevPackages] = useState<PrevPackage[]>([])
  const [prevInquiries, setPrevInquiries] = useState<PrevInquiry[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
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

  // Per-instructor breakdown
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
        <div className="flex-1 flex items-center justify-center h-8 rounded-lg bg-white/[0.03] border border-white/[0.07] px-3">
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
        {([
          {
            label: 'Проведени', value: completed,
            sub: `${totalHours.toFixed(0)}ч общо`, color: 'text-emerald-400',
            trend: trendPct(completed, prevCompleted), trendUp: trendPositive(completed, prevCompleted),
          },
          {
            label: 'Приходи', value: `€${revenue.toFixed(0)}`,
            sub: `${periodPackages.filter(p => selectedInstructor === 'all' || p.instructor_id === selectedInstructor).length} пакета`, color: 'text-emerald-400',
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
            trend: null as string | null, trendUp: true,
          },
        ] as const).map(kpi => (
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

      {/* ── Спечелени клиенти (Conversion) ── */}
      {inquiries.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Спечелени клиенти</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{conversionPct}%</span>
                <span className="text-[11px] text-white/35">{wonInquiries} от {inquiries.length} запитвания</span>
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

      {/* ── Откъде разбраха за нас ── */}
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
              {[...monthlySummary].reverse().slice(0, 6).map(row => {
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

      {/* Alerts row */}
      {(renewalNeeded > 0 || expiringPackages.length > 0 || cancelledLate > 0) && (
        <div className="flex flex-wrap gap-3">
          {/* Renewal needed */}
          {renewalNeeded > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="text-xs font-semibold text-red-400">{renewalNeeded} клиента</div>
                <div className="text-[10px] text-red-400/70">трябва подновяване на пакет</div>
              </div>
            </div>
          )}

          {/* Expiring packages — expandable list */}
          {expiringPackages.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <button
                onClick={() => setShowExpiringClients(!showExpiringClients)}
                className="w-full flex items-center justify-between gap-2 bg-amber-400/[0.05] border border-amber-400/10 rounded-xl px-4 py-2.5 hover:bg-amber-400/[0.08] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-amber-400">{expiringPackages.length} пакета изтичат</div>
                    <div className="text-[10px] text-amber-400/60">до 2 седмици</div>
                  </div>
                </div>
                <span className={`text-amber-400/50 text-xs transition-transform ${showExpiringClients ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {showExpiringClients && (
                <div className="mt-1.5 bg-amber-400/[0.03] border border-amber-400/10 rounded-xl overflow-hidden">
                  {expiringPackages.map(pkg => {
                    const daysLeft = Math.ceil((new Date(pkg.expires_at!).getTime() - Date.now()) / 86400000)
                    // Get name from sessions that match this client
                    const sessionMatch = sessions.find(s => s.client_id === pkg.client_id)
                    const clientName = sessionMatch?.client?.name || `Клиент ${pkg.client_id.slice(0, 6)}`
                    return (
                      <div key={pkg.id} className="flex items-center justify-between px-4 py-2 border-b border-amber-400/[0.06] last:border-0">
                        <div>
                          <div className="text-xs text-white/70">{clientName}</div>
                          <div className="text-[10px] text-white/30">
                            {new Date(pkg.expires_at!).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <span className={`text-[11px] font-medium ${daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                          {daysLeft}д
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Late cancellations */}
          {cancelledLate > 0 && (
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
              <span className="text-lg">📵</span>
              <div>
                <div className="text-xs font-semibold text-orange-400">{cancelledLate} отмени</div>
                <div className="text-[10px] text-orange-400/70">последен момент (&lt;24ч)</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-instructor breakdown */}
      {selectedInstructor === 'all' && instructorStats.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <div className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">По инструктор</div>
          <div className="space-y-3">
            {instructorStats.map(inst => {
              const total = inst.completed + inst.noShows
              const nsRate = total > 0 ? ((inst.noShows / total) * 100).toFixed(0) : '0'
              const maxRevenue = Math.max(...instructorStats.map(i => i.revenue), 1)
              return (
                <div key={inst.name} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <div>
                    <div className="text-xs text-white/70 mb-1">{inst.name}</div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${(inst.revenue / maxRevenue) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-400">€{inst.revenue.toFixed(0)}</div>
                    <div className="text-[10px] text-white/30">{inst.clients.size} клиента</div>
                  </div>
                  {inst.noShows > 0 && (
                    <div className="text-[10px] text-red-400/60">{nsRate}% неяв</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Revenue summary */}
      {revenue > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
            Приходи от пакети — {viewMonth !== null ? 'месец' : 'година'}
          </div>
          <div className="text-3xl font-bold text-emerald-400">€{revenue.toFixed(0)}</div>
          <div className="text-[11px] text-white/30 mt-1">{periodPackages.filter(p => selectedInstructor === 'all' || p.instructor_id === selectedInstructor).length} продадени пакета</div>
        </div>
      )}

      {/* Clients who trained this period */}
      {clientsWithSessions.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              Клиенти с проведени тренировки — {clientsWithSessions.length}
            </span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {clientsWithSessions.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-xs text-white font-medium">{c.name}</div>
                  {selectedInstructor === 'all' && (
                    <div className="text-[10px] text-white/30">{c.instructorName}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-semibold">{c.count}</span>
                  <span className="text-[10px] text-white/30">тренировки</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
