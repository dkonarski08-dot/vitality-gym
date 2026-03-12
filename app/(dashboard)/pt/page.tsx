// app/(dashboard)/pt/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import PTWeekView from './components/PTWeekView'
import PTClientList from './components/PTClientList'
import PTAdminKPI from './components/PTAdminKPI'
import PTSessionModal from './components/PTSessionModal'
import PTClientModal from './components/PTClientModal'
import PTInquiryModal from './components/PTInquiryModal'
import PTInquiryList, { PTInquiry } from './components/PTInquiryList'
import { MONTHS_BG } from '@/lib/formatters'

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled_early' | 'cancelled_late' | 'no_show'
export type SessionType = 'personal' | 'pair' | 'online'

export interface Instructor { id: string; name: string; role: string }
export interface PTClient {
  id: string; instructor_id: string; name: string; phone: string | null
  email: string | null; goal: string | null; health_notes: string | null; active: boolean
  instructor: { id: string; name: string } | null
  packages: PTPackage[]
}
export interface PTPackage {
  id: string; client_id: string; instructor_id: string
  total_sessions: number; used_sessions: number
  price_total: number | null; purchased_at: string; expires_at: string | null
  active: boolean; notes: string | null
}
export interface PTSession {
  id: string; instructor_id: string; client_id: string; package_id: string | null
  scheduled_at: string; duration_minutes: number; session_type: SessionType
  status: SessionStatus; location: string | null; notes: string | null
  cancelled_at: string | null; cancelled_by: string | null
  recurrence_group_id: string | null; created_by: string | null
  client: { id: string; name: string; phone: string | null; goal: string | null } | null
  instructor: { id: string; name: string } | null
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

type Tab = 'week' | 'clients' | 'inquiries' | 'kpi'

export default function PTPage() {
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window === 'undefined') return 'admin'
    try { const p = JSON.parse(localStorage.getItem('vitality_session') || '{}'); return p.role || 'admin' } catch { return 'admin' }
  })
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try { const p = JSON.parse(localStorage.getItem('vitality_session') || '{}'); return p.name || '' } catch { return '' }
  })
  const [myInstructorId, setMyInstructorId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { const p = JSON.parse(localStorage.getItem('vitality_session') || '{}'); return p.employeeId || null } catch { return null }
  })
  const [tab, setTab] = useState<Tab>('week')

  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all')
  const [clients, setClients] = useState<PTClient[]>([])
  const [sessions, setSessions] = useState<PTSession[]>([])
  const [inquiries, setInquiries] = useState<PTInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()))

  // Modals
  const [sessionModal, setSessionModal] = useState<{
    mode: 'add' | 'edit'
    session?: PTSession
    prefillDate?: string
    prefillTime?: string
    prefillInstructorId?: string
  } | null>(null)
  const [clientModal, setClientModal] = useState<{ mode: 'add' | 'edit'; client?: PTClient } | null>(null)
  const [inquiryModal, setInquiryModal] = useState(false)

  // Session is read synchronously via useState initializers above; this effect handles edge cases
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('vitality_session') || '{}')
      if (p.role) setUserRole(p.role)
      if (p.name) setUserName(p.name)
      if (p.employeeId) setMyInstructorId(p.employeeId)
    } catch {}
  }, [])

  const loadInstructors = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/pt?type=instructors')
    if (!res.ok) throw new Error(`Instructors: ${res.status}`)
    const data = await res.json()
    setInstructors(data.instructors || [])
  }, [])

  const loadSessions = useCallback(async (instructorIdOverride?: string | null) => {
    const monday = weekStart.toISOString().split('T')[0]
    const params = new URLSearchParams({ type: 'sessions_week', week_start: monday })
    const filterId = instructorIdOverride !== undefined
      ? instructorIdOverride
      : (userRole === 'instructor' ? myInstructorId : (selectedInstructor !== 'all' ? selectedInstructor : null))
    if (filterId) params.set('instructor_id', filterId)
    const res = await fetch(`/api/pt?${params}`)
    if (!res.ok) throw new Error(`Sessions: ${res.status}`)
    const data = await res.json()
    setSessions(data.sessions || [])
  }, [weekStart, selectedInstructor, userRole, myInstructorId])

  const loadClients = useCallback(async (instructorIdOverride?: string | null) => {
    const params = new URLSearchParams({ type: 'clients' })
    const filterId = instructorIdOverride !== undefined
      ? instructorIdOverride
      : (userRole === 'instructor' ? myInstructorId : (selectedInstructor !== 'all' ? selectedInstructor : null))
    if (filterId) params.set('instructor_id', filterId)
    const res = await fetch(`/api/pt?${params}`)
    if (!res.ok) throw new Error(`Clients: ${res.status}`)
    const data = await res.json()
    setClients(data.clients || [])
  }, [selectedInstructor, userRole, myInstructorId])

  const loadInquiries = useCallback(async (instructorIdOverride?: string | null) => {
    const params = new URLSearchParams({ type: 'inquiries' })
    const filterId = instructorIdOverride !== undefined ? instructorIdOverride : (userRole === 'instructor' ? myInstructorId : null)
    if (filterId) params.set('instructor_id', filterId)
    const res = await fetch(`/api/pt?${params}`)
    if (!res.ok) throw new Error(`Inquiries: ${res.status}`)
    const data = await res.json()
    setInquiries(data.inquiries || [])
  }, [userRole, myInstructorId])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const sessionFilter = userRole === 'instructor' ? myInstructorId : (selectedInstructor !== 'all' ? selectedInstructor : null)
      await Promise.all([
        loadInstructors(),
        loadSessions(sessionFilter),
        loadClients(sessionFilter),
        loadInquiries(userRole === 'instructor' ? myInstructorId : null),
      ])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Грешка при зареждане на данните')
    } finally {
      setLoading(false)
    }
  }, [loadInstructors, loadSessions, loadClients, loadInquiries, userRole, myInstructorId, selectedInstructor])

  // Single effect — loadAll вече включва loadSessions вътре
  // Отделният effect за loadSessions причиняваше race condition при промяна на selectedInstructor
  useEffect(() => { loadAll() }, [loadAll])

  const weekLabel = (() => {
    const sun = new Date(weekStart); sun.setDate(weekStart.getDate() + 6)
    if (weekStart.getMonth() === sun.getMonth())
      return `${weekStart.getDate()} – ${sun.getDate()} ${MONTHS_BG[sun.getMonth()]} ${sun.getFullYear()}`
    return `${weekStart.getDate()} ${MONTHS_BG[weekStart.getMonth()]} – ${sun.getDate()} ${MONTHS_BG[sun.getMonth()]}`
  })()

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday = () => setWeekStart(getMondayOfWeek(new Date()))

  // Pending inquiries badge count
  const pendingInquiries = inquiries.filter(i => i.status === 'pending').length

  // Build tabs dynamically
  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'week',      label: '📅 Седмица' },
    { id: 'clients',   label: '👥 Клиенти' },
    { id: 'inquiries', label: '📞 Запитвания', badge: pendingInquiries },
    ...(userRole === 'admin' ? [{ id: 'kpi' as Tab, label: '📊 Статистика' }] : []),
  ]

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">PT Календар</h1>
            <p className="text-sm text-white/50 mt-0.5">Персонални тренировки</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Instructor filter */}
            {userRole !== 'instructor' && instructors.length > 0 && (
              <select
                value={selectedInstructor}
                onChange={e => setSelectedInstructor(e.target.value)}
                className="h-8 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-amber-400/50">
                <option value="all">Всички инструктори</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}

            {/* Week nav */}
            {tab === 'week' && (
              <div className="flex items-center gap-1">
                <button onClick={prevWeek} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">‹</button>
                <button onClick={goToday} className="px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/60">Днес</button>
                <button onClick={nextWeek} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">›</button>
                <span className="text-xs text-white/60 ml-1 hidden sm:block">{weekLabel}</span>
              </div>
            )}

            {/* +Запитване */}
            <button
              onClick={() => setInquiryModal(true)}
              className="px-3 h-8 rounded-lg text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/15 flex items-center gap-1.5">
              <span>📞</span>
              <span>+ Запитване</span>
              {pendingInquiries > 0 && (
                <span className="bg-sky-400/20 text-sky-300 text-[9px] rounded-full px-1.5 font-semibold">
                  {pendingInquiries}
                </span>
              )}
            </button>

            {/* +Тренировка */}
            <button
              onClick={() => setSessionModal({ mode: 'add' })}
              className="px-3 h-8 rounded-lg text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15">
              + Тренировка
            </button>

            {/* +Клиент */}
            <button
              onClick={() => setClientModal({ mode: 'add' })}
              className="px-3 h-8 rounded-lg text-xs font-medium bg-white/5 text-white/60 border border-white/[0.08] hover:text-white">
              + Клиент
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.id
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                  : 'text-white/50 hover:text-white/80'
              }`}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className={`text-[9px] rounded-full px-1.5 font-semibold ${
                  tab === t.id ? 'bg-amber-400/20 text-amber-300' : 'bg-sky-500/20 text-sky-400'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-4 md:p-6">
        {loadError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <span>⚠️ {loadError}</span>
            <button onClick={loadAll} className="ml-auto text-xs underline hover:no-underline">Опитай пак</button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'week' && (
              <PTWeekView
                weekStart={weekStart}
                sessions={sessions}
                instructors={instructors}
                selectedInstructor={selectedInstructor}
                userRole={userRole}
                onAddSession={(date, time, instructorId) =>
                  setSessionModal({ mode: 'add', prefillDate: date, prefillTime: time, prefillInstructorId: instructorId })}
                onEditSession={session => setSessionModal({ mode: 'edit', session })}
                onRefresh={loadSessions}
              />
            )}

            {tab === 'clients' && (
              <PTClientList
                clients={clients}
                instructors={instructors}
                userRole={userRole}
                onEditClient={client => setClientModal({ mode: 'edit', client })}
                onRefresh={loadClients}
              />
            )}

            {tab === 'inquiries' && (
              <PTInquiryList
                inquiries={inquiries}
                instructors={instructors}
                userRole={userRole}
                onRefresh={loadInquiries}
              />
            )}

            {tab === 'kpi' && userRole === 'admin' && (
              <PTAdminKPI selectedInstructor={selectedInstructor} />
            )}
          </>
        )}
      </div>

      {/* ── Session Modal ── */}
      {sessionModal && (
        <PTSessionModal
          mode={sessionModal.mode}
          session={sessionModal.session}
          prefillDate={sessionModal.prefillDate}
          prefillTime={sessionModal.prefillTime}
          prefillInstructorId={sessionModal.prefillInstructorId}
          instructors={instructors}
          clients={clients}
          userRole={userRole}
          userName={userName}
          onClose={() => setSessionModal(null)}
          onSaved={async () => { setSessionModal(null); await loadSessions() }}
        />
      )}

      {/* ── Client Modal ── */}
      {clientModal && (
        <PTClientModal
          mode={clientModal.mode}
          client={clientModal.client}
          instructors={instructors}
          userRole={userRole}
          onClose={() => setClientModal(null)}
          onSaved={async () => { setClientModal(null); await loadAll() }}
        />
      )}

      {/* ── Inquiry Modal ── */}
      {inquiryModal && (
        <PTInquiryModal
          instructors={instructors}
          userRole={userRole}
          userName={userName}
          onClose={() => setInquiryModal(false)}
          onSaved={async () => {
            setInquiryModal(false)
            await loadInquiries()
            // Switch to inquiries tab so user sees the new entry
            setTab('inquiries')
          }}
        />
      )}
    </div>
  )
}
