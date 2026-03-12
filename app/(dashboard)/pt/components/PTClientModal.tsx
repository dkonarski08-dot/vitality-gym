// app/(dashboard)/pt/components/PTClientModal.tsx
'use client'

import { useState } from 'react'
import { PTClient, PTPackage, Instructor } from '../page'

interface Props {
  mode: 'add' | 'edit'
  client?: PTClient
  instructors: Instructor[]
  userRole: string
  onClose: () => void
  onSaved: () => void
}

const DAYS_BG = [
  { value: 'monday',    label: 'Пн' },
  { value: 'tuesday',   label: 'Вт' },
  { value: 'wednesday', label: 'Ср' },
  { value: 'thursday',  label: 'Чт' },
  { value: 'friday',    label: 'Пт' },
  { value: 'saturday',  label: 'Сб' },
  { value: 'sunday',    label: 'Нд' },
]

const TIME_SLOTS = [
  { value: 'morning',   label: '8:00 – 12:00',  icon: '🌅' },
  { value: 'afternoon', label: '12:00 – 16:00', icon: '☀️' },
  { value: 'evening',   label: '16:00 – 20:00', icon: '🌆' },
]

const DURATION_OPTIONS = [1, 2, 3, 6, 12]

function calcExpiresAt(startsOn: string, durationMonths: number): string {
  if (!startsOn || !durationMonths) return ''
  const d = new Date(startsOn)
  d.setMonth(d.getMonth() + durationMonths)
  return d.toISOString().split('T')[0]
}

export default function PTClientModal({ mode, client, instructors, userRole, onClose, onSaved }: Props) {
  const [name, setName] = useState(client?.name || '')
  const [instructorId, setInstructorId] = useState(client?.instructor_id || instructors[0]?.id || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [email, setEmail] = useState(client?.email || '')
  const [goal, setGoal] = useState(client?.goal || '')
  const [healthNotes, setHealthNotes] = useState(client?.health_notes || '')
  const [active, setActive] = useState(client?.active ?? true)
  // Preferred scheduling
  const [preferredDays, setPreferredDays] = useState<string[]>(
    (client as PTClient & { preferred_days?: string[] })?.preferred_days || []
  )
  const [preferredTimeSlot, setPreferredTimeSlot] = useState(
    (client as PTClient & { preferred_time_slot?: string })?.preferred_time_slot || ''
  )
  const [saving, setSaving] = useState(false)

  // Package state
  const [showAddPackage, setShowAddPackage] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [pkgSessionsPreset, setPkgSessionsPreset] = useState<number | null>(null)
  const [pkgSessionsCustom, setPkgSessionsCustom] = useState('')
  const [pkgPrice, setPkgPrice] = useState('')
  const [pkgStartsOn, setPkgStartsOn] = useState(new Date().toISOString().split('T')[0])
  const [pkgDurationMonths, setPkgDurationMonths] = useState<number | null>(null)
  const [savingPkg, setSavingPkg] = useState(false)

  // Editing remaining sessions on active package
  const [editingRemaining, setEditingRemaining] = useState(false)
  const [remainingEdit, setRemainingEdit] = useState('')
  const [savingRemaining, setSavingRemaining] = useState(false)

  const activePackage = client?.packages?.find(p => p.active)
  const historyPackages = client?.packages?.filter(p => !p.active) || []
  const remaining = activePackage ? activePackage.total_sessions - activePackage.used_sessions : null

  const pkgSessions = pkgSessionsCustom ? Number(pkgSessionsCustom) : (pkgSessionsPreset ?? 0)
  const pkgExpiresAt = pkgStartsOn && pkgDurationMonths ? calcExpiresAt(pkgStartsOn, pkgDurationMonths) : ''
  const pkgValid = pkgSessions > 0 && !!pkgPrice && !!pkgStartsOn && !!pkgDurationMonths

  const toggleDay = (day: string) => {
    setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    const payload = {
      instructor_id: instructorId, name, phone, email, goal,
      health_notes: healthNotes, active,
      preferred_days: preferredDays.length > 0 ? preferredDays : null,
      preferred_time_slot: preferredTimeSlot || null,
    }
    if (mode === 'add') {
      await fetch('/api/pt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_client', ...payload })
      })
    } else if (client) {
      await fetch('/api/pt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit_client', client_id: client.id, ...payload })
      })
    }
    setSaving(false)
    onSaved()
  }

  const handleAddPackage = async () => {
    if (!client || !pkgValid) return
    setSavingPkg(true)
    await fetch('/api/pt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_package',
        client_id: client.id,
        instructor_id: client.instructor_id,
        total_sessions: pkgSessions,
        price_total: Number(pkgPrice),
        purchased_at: pkgStartsOn,
        starts_on: pkgStartsOn,
        expires_at: pkgExpiresAt || null,
        duration_months: pkgDurationMonths,
      })
    })
    setSavingPkg(false)
    setShowAddPackage(false)
    // Reset form
    setPkgSessionsPreset(null); setPkgSessionsCustom(''); setPkgPrice('')
    setPkgStartsOn(new Date().toISOString().split('T')[0]); setPkgDurationMonths(null)
    onSaved()
  }

  const handleSaveRemaining = async () => {
    if (!activePackage || remainingEdit === '') return
    setSavingRemaining(true)
    const newUsed = activePackage.total_sessions - Number(remainingEdit)
    await fetch('/api/pt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_package_used', package_id: activePackage.id, used_sessions: Math.max(0, newUsed) })
    })
    setSavingRemaining(false)
    setEditingRemaining(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-[420px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="text-sm font-semibold text-white mb-4">
          {mode === 'add' ? '+ Нов клиент' : 'Редактирай клиент'}
        </div>

        {/* ── Basic info ── */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Име *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
          </div>

          {userRole !== 'instructor' && (
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Инструктор</label>
              <select value={instructorId} onChange={e => setInstructorId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}

          {/* Phone (required) + Email */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Телефон *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+359..."
                className={`w-full h-9 px-3 rounded-lg bg-white/5 border text-white text-sm placeholder:text-white/20 focus:outline-none ${
                  !phone.trim() ? 'border-red-500/30 focus:border-red-400/50' : 'border-white/[0.08] focus:border-amber-400/50'
                }`} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Цел</label>
            <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Отслабване, покачване на маса..."
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
          </div>

          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Здравни бележки</label>
            <textarea value={healthNotes} onChange={e => setHealthNotes(e.target.value)} rows={2}
              placeholder="Наранявания, противопоказания..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 resize-none" />
          </div>

          {/* ── Preferred days ── */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Предпочитани дни</label>
            <div className="flex gap-1">
              {DAYS_BG.map(d => (
                <button key={d.value} onClick={() => toggleDay(d.value)}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium border transition-all ${
                    preferredDays.includes(d.value)
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Preferred time slot ── */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Предпочитан час</label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIME_SLOTS.map(slot => (
                <button key={slot.value}
                  onClick={() => setPreferredTimeSlot(prev => prev === slot.value ? '' : slot.value)}
                  className={`h-9 rounded-lg text-xs border transition-all flex flex-col items-center justify-center gap-0.5 ${
                    preferredTimeSlot === slot.value
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}>
                  <span>{slot.icon}</span>
                  <span className="text-[9px]">{slot.label}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'edit' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setActive(!active)}
                className={`w-8 h-4 rounded-full transition-colors relative ${active ? 'bg-emerald-400' : 'bg-white/10'}`}>
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: active ? '18px' : '2px' }} />
              </div>
              <span className="text-[11px] text-white/60">Активен клиент</span>
            </label>
          )}
        </div>

        {/* ── Package section (edit only) ── */}
        {mode === 'edit' && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/60 font-semibold uppercase tracking-wider">Пакет</span>
              <button onClick={() => setShowAddPackage(!showAddPackage)}
                className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                  showAddPackage ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'text-amber-400/60 border-transparent hover:text-amber-400'
                }`}>
                + Нов пакет
              </button>
            </div>

            {/* Active package */}
            {activePackage ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Активен</span>
                  {userRole === 'admin' && (
                    <button onClick={() => { setEditingRemaining(!editingRemaining); setRemainingEdit(String(remaining ?? 0)) }}
                      className="text-[10px] text-white/30 hover:text-amber-400 transition-colors">
                      {editingRemaining ? 'отказ' : '✏️ редактирай'}
                    </button>
                  )}
                </div>

                {editingRemaining ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-white/50">Оставащи сесии:</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setRemainingEdit(prev => String(Math.max(0, Number(prev) - 1)))}
                        className="w-7 h-7 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 text-sm">−</button>
                      <input value={remainingEdit} onChange={e => setRemainingEdit(e.target.value)}
                        type="number" min="0" max={activePackage.total_sessions}
                        className="w-12 h-7 text-center rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50" />
                      <button onClick={() => setRemainingEdit(prev => String(Math.min(activePackage.total_sessions, Number(prev) + 1)))}
                        className="w-7 h-7 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 text-sm">+</button>
                    </div>
                    <button onClick={handleSaveRemaining} disabled={savingRemaining}
                      className="ml-auto px-3 h-7 rounded-lg text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 disabled:opacity-30">
                      {savingRemaining ? '...' : '✓'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/50">Оставащи</span>
                      <span className={`font-semibold ${remaining !== null && remaining <= 2 ? 'text-red-400' : 'text-white'}`}>
                        {remaining} / {activePackage.total_sessions} сесии
                        {remaining !== null && remaining <= 2 && ' ⚠️'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${remaining !== null && remaining <= 2 ? 'bg-red-400' : 'bg-amber-400'}`}
                        style={{ width: `${Math.max(2, (activePackage.used_sessions / activePackage.total_sessions) * 100)}%` }} />
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  {activePackage.price_total && <span>€{activePackage.price_total}</span>}
                  {activePackage.purchased_at && (
                    <span>От {new Date(activePackage.purchased_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}</span>
                  )}
                  {activePackage.expires_at && (
                    <span className={new Date(activePackage.expires_at) < new Date(Date.now() + 14 * 86400000) ? 'text-amber-400/70' : ''}>
                      До {new Date(activePackage.expires_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-white/25 text-center py-3 border border-dashed border-white/[0.06] rounded-xl">
                Без активен пакет
              </div>
            )}

            {/* Add package form */}
            {showAddPackage && (
              <div className="bg-white/[0.02] border border-amber-400/10 rounded-xl p-4 space-y-3">
                <div className="text-[11px] text-amber-400 font-semibold">Нов пакет</div>

                {/* Session count — presets + custom */}
                <div>
                  <label className="text-[10px] text-white/40 mb-1.5 block">Брой сесии *</label>
                  <div className="flex gap-1.5 mb-1.5">
                    {[8, 10, 15, 20, 30].map(n => (
                      <button key={n} onClick={() => { setPkgSessionsPreset(n); setPkgSessionsCustom('') }}
                        className={`flex-1 h-8 rounded-lg text-xs border transition-all ${
                          pkgSessionsPreset === n && !pkgSessionsCustom
                            ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                            : 'bg-white/5 text-white/50 border-white/[0.08] hover:text-white/70'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    value={pkgSessionsCustom}
                    onChange={e => { setPkgSessionsCustom(e.target.value); setPkgSessionsPreset(null) }}
                    type="number" min="1" placeholder="Друго число..."
                    className={`w-full h-8 px-3 rounded-lg bg-white/5 border text-white text-xs placeholder:text-white/20 focus:outline-none ${
                      pkgSessionsCustom ? 'border-amber-400/30 focus:border-amber-400/50' : 'border-white/[0.08] focus:border-white/20'
                    }`} />
                </div>

                {/* Price (required) */}
                <div>
                  <label className="text-[10px] text-white/40 mb-1 block">Цена (€) *</label>
                  <input value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} type="number" min="0" placeholder="0"
                    className={`w-full h-8 px-3 rounded-lg bg-white/5 border text-white text-xs placeholder:text-white/20 focus:outline-none ${
                      !pkgPrice ? 'border-white/[0.08]' : 'border-amber-400/30'
                    }`} />
                </div>

                {/* Start date (required) + Duration */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Начална дата *</label>
                    <input value={pkgStartsOn} onChange={e => setPkgStartsOn(e.target.value)} type="date"
                      className="w-full h-8 px-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-amber-400/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Продължителност *</label>
                    <div className="flex gap-1">
                      {DURATION_OPTIONS.map(m => (
                        <button key={m} onClick={() => setPkgDurationMonths(m)}
                          className={`flex-1 h-8 rounded-lg text-[10px] border transition-all ${
                            pkgDurationMonths === m
                              ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                              : 'bg-white/5 text-white/40 border-white/[0.08] hover:text-white/60'
                          }`}>
                          {m}м
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculated expiry preview */}
                {pkgExpiresAt && (
                  <div className="text-[10px] text-white/30 flex items-center gap-1">
                    <span>⏰ Изтича на:</span>
                    <span className="text-white/50">{new Date(pkgExpiresAt).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}

                <button onClick={handleAddPackage} disabled={savingPkg || !pkgValid}
                  className="w-full h-9 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 disabled:opacity-30 disabled:cursor-not-allowed">
                  {savingPkg ? '...' : '+ Добави пакет'}
                </button>
              </div>
            )}

            {/* Package history */}
            {historyPackages.length > 0 && (
              <div>
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors">
                  <span className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
                  История ({historyPackages.length} пакета)
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-1.5">
                    {historyPackages.map(pkg => (
                      <div key={pkg.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-white/40">{pkg.total_sessions} сесии</span>
                          {pkg.purchased_at && (
                            <span className="text-[10px] text-white/20 ml-2">
                              {new Date(pkg.purchased_at).toLocaleDateString('bg-BG', { month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {pkg.price_total && <span className="text-[10px] text-white/30">€{pkg.price_total}</span>}
                          <span className="text-[10px] text-white/20 ml-2">{pkg.used_sessions} изп.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-xs text-white/50 bg-white/5 border border-white/[0.08]">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()}
            className="flex-1 h-10 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 disabled:opacity-30">
            {saving ? '...' : mode === 'add' ? '+ Добави' : '💾 Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
