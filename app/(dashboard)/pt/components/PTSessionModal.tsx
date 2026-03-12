// app/(dashboard)/pt/components/PTSessionModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { PTSession, PTClient, Instructor, SessionStatus, SessionType } from '../page'

interface Props {
  mode: 'add' | 'edit'
  session?: PTSession
  prefillDate?: string
  prefillTime?: string
  prefillInstructorId?: string
  instructors: Instructor[]
  clients: PTClient[]
  userRole: string
  userName: string
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS: { value: SessionStatus; label: string; color: string }[] = [
  { value: 'scheduled',       label: 'Планирана',          color: 'text-amber-400' },
  { value: 'completed',       label: 'Проведена',          color: 'text-emerald-400' },
  { value: 'cancelled_early', label: 'Отменена навреме',   color: 'text-white/50' },
  { value: 'cancelled_late',  label: 'Отменена (< 24ч)',   color: 'text-red-400' },
  { value: 'no_show',         label: 'Неявяване',          color: 'text-red-400' },
]

const DURATIONS = [30, 45, 60, 90]

export default function PTSessionModal({ mode, session, prefillDate, prefillTime, prefillInstructorId,
  instructors, clients, userRole, userName, onClose, onSaved }: Props) {

  const today = new Date().toISOString().split('T')[0]

  const [instructorId, setInstructorId] = useState(
    session?.instructor_id || prefillInstructorId || instructors[0]?.id || ''
  )
  const [clientId, setClientId] = useState(session?.client_id || '')
  const [date, setDate] = useState(
    session ? new Date(session.scheduled_at).toISOString().split('T')[0] : (prefillDate || today)
  )
  const [time, setTime] = useState(() => {
    if (session) {
      const d = new Date(session.scheduled_at)
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    return prefillTime || '10:00'
  })
  const [duration, setDuration] = useState(session?.duration_minutes || 60)
  const [sessionType, setSessionType] = useState<SessionType>(session?.session_type ?? 'personal')
  const [status, setStatus] = useState<SessionStatus>(session?.status || 'scheduled')
  const [location, setLocation] = useState(session?.location || '')
  const [notes, setNotes] = useState(session?.notes || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDay, setRecurringDay] = useState(1)
  const [recurringEnd, setRecurringEnd] = useState('')

  // Filter clients by selected instructor
  const filteredClients = clients.filter(c => c.active && c.instructor_id === instructorId)

  // Active package for selected client
  const activePackage = clients.find(c => c.id === clientId)?.packages?.find(p => p.active)
  const remaining = activePackage ? activePackage.total_sessions - activePackage.used_sessions : null

  const handleSave = async () => {
    if (!clientId || !instructorId || !date || !time) return
    setSaving(true)
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString()

    if (mode === 'add') {
      if (isRecurring) {
        await fetch('/api/pt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_recurring',
            instructor_id: instructorId, client_id: clientId,
            package_id: activePackage?.id || null,
            day_of_week: recurringDay,
            time_of_day: time,
            duration_minutes: duration,
            session_type: sessionType,
            location, starts_on: date,
            ends_on: recurringEnd || null,
            created_by: userName,
          })
        })
      } else {
        await fetch('/api/pt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_session',
            instructor_id: instructorId, client_id: clientId,
            package_id: activePackage?.id || null,
            scheduled_at, duration_minutes: duration,
            session_type: sessionType, location, notes,
            created_by: userName,
          })
        })
      }
    } else if (session) {
      await fetch('/api/pt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_session', session_id: session.id,
          status, notes, scheduled_at, duration_minutes: duration, location,
          cancelled_by: ['cancelled_early','cancelled_late','no_show'].includes(status) ? 'receptionist' : undefined,
        })
      })
    }
    setSaving(false)
    onSaved()
  }

  const handleDelete = async () => {
    if (!session) return
    setDeleting(true)
    await fetch('/api/pt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_session', session_id: session.id })
    })
    setDeleting(false)
    onSaved()
  }

  const DAYS_BG = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-96 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="text-sm font-semibold text-white mb-4">
          {mode === 'add' ? '+ Нова тренировка' : 'Редактирай тренировка'}
        </div>

        {/* Instructor */}
        {userRole !== 'instructor' && (
          <div className="mb-3">
            <label className="text-[11px] text-white/50 mb-1 block">Инструктор</label>
            <select value={instructorId} onChange={e => { setInstructorId(e.target.value); setClientId('') }}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
              {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        )}

        {/* Client */}
        <div className="mb-3">
          <label className="text-[11px] text-white/50 mb-1 block">Клиент</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
            <option value="">— избери клиент —</option>
            {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Package info */}
          {clientId && (
            <div className="mt-1.5 flex items-center gap-2">
              {activePackage ? (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  remaining !== null && remaining <= 2
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  📦 {remaining} / {activePackage.total_sessions} сесии
                  {remaining !== null && remaining <= 2 && ' ⚠️'}
                </span>
              ) : (
                <span className="text-[11px] text-white/30 px-2 py-0.5 rounded-full border border-white/10">
                  Няма активен пакет
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50" />
          </div>
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Час</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50" />
          </div>
        </div>

        {/* Duration & Type */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Продължителност</label>
            <div className="flex gap-1">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-all ${
                    duration === d ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-white/5 text-white/50 border-white/[0.08]'
                  }`}>
                  {d}′
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Тип</label>
            <select value={sessionType} onChange={e => setSessionType(e.target.value as SessionType)}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
              <option value="personal">👤 Персонална</option>
              <option value="pair">👥 Двойна</option>
              <option value="online">💻 Онлайн</option>
            </select>
          </div>
        </div>

        {/* Status (edit only) */}
        {mode === 'edit' && (
          <div className="mb-3">
            <label className="text-[11px] text-white/50 mb-1 block">Статус</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setStatus(opt.value)}
                  className={`h-8 rounded-lg text-xs border transition-all ${
                    status === opt.value ? `bg-white/10 border-white/20 ${opt.color}` : 'bg-white/[0.03] border-white/[0.06] text-white/40'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recurring (add only) */}
        {mode === 'add' && (
          <div className="mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setIsRecurring(!isRecurring)}
                className={`w-8 h-4 rounded-full transition-colors relative ${isRecurring ? 'bg-amber-400' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isRecurring ? 'left-4.5' : 'left-0.5'}`} style={{ left: isRecurring ? '18px' : '2px' }} />
              </div>
              <span className="text-[11px] text-white/60">Повтарящa се (всяка седмица)</span>
            </label>
            {isRecurring && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-white/50 mb-1 block">Ден</label>
                  <select value={recurringDay} onChange={e => setRecurringDay(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-xs focus:outline-none">
                    {[1,2,3,4,5,6,0].map(d => <option key={d} value={d}>{DAYS_BG[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/50 mb-1 block">До дата (незадъл.)</label>
                  <input type="date" value={recurringEnd} onChange={e => setRecurringEnd(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-xs focus:outline-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div className="mb-3">
          <label className="text-[11px] text-white/50 mb-1 block">Зала / локация</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Зала 1"
            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-[11px] text-white/50 mb-1 block">Бележки</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Упражнения, прогрес..."
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 resize-none" />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {mode === 'edit' && !showDeleteConfirm && (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-3 h-10 rounded-xl text-xs text-red-400/60 border border-red-500/10 hover:border-red-500/30 hover:text-red-400">
              Изтрий
            </button>
          )}
          {showDeleteConfirm && (
            <button onClick={handleDelete} disabled={deleting}
              className="px-3 h-10 rounded-xl text-xs bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-40">
              {deleting ? '...' : 'Потвърди изтриване'}
            </button>
          )}
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-xs text-white/50 bg-white/5 border border-white/[0.08]">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving || !clientId}
            className="flex-1 h-10 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 disabled:opacity-30">
            {saving ? '...' : mode === 'add' ? (isRecurring ? '⚡ Добави серия' : '+ Добави') : '💾 Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
