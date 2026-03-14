// app/(dashboard)/pt/components/PTClientModal.tsx
'use client'

import { useState } from 'react'
import { PTClient, PTPackage, Instructor } from '../page'
import PTPackageModal from './PTPackageModal'

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
  { key: 'morning',   label: 'Сутрин',  range: '8:00 – 12:00',  emoji: '🌅' },
  { key: 'afternoon', label: 'Обяд',    range: '12:00 – 16:00', emoji: '☀️' },
  { key: 'evening',   label: 'Вечер',   range: '16:00 – 20:00', emoji: '🌙' },
]

const GOALS = [
  { key: 'weight_loss', label: '⚖️ Отслабване и стройност' },
  { key: 'muscle',      label: '💪 Мускулна маса и сила' },
  { key: 'cardio',      label: '🏃 Кардио и издръжливост' },
  { key: 'rehab',       label: '🩺 Рехабилитация и здраве' },
  { key: 'general',     label: '✨ Обща форма и тонус' },
]

const SOURCES = [
  { key: 'facebook',  label: '📘 Фейсбук' },
  { key: 'instagram', label: '📸 Инстаграм' },
  { key: 'google',    label: '🔍 Гугъл' },
  { key: 'friend',    label: '👥 Приятел' },
  { key: 'nearby',    label: '📍 Живея наблизо' },
]

export default function PTClientModal({ mode, client, instructors, userRole, onClose, onSaved }: Props) {
  const [name, setName] = useState(client?.name || '')
  const [instructorId, setInstructorId] = useState(client?.instructor_id || instructors[0]?.id || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [email, setEmail] = useState(client?.email || '')
  const [goal, setGoal] = useState(client?.goal || '')
  const [source, setSource] = useState(client?.source || '')
  const [healthNotes, setHealthNotes] = useState(client?.health_notes || '')
  const [active, setActive] = useState(client?.active ?? true)
  const [preferredDays, setPreferredDays] = useState<string[]>(client?.preferred_days || [])
  // preferred_time_slot stored as comma-separated; parse to array
  const [selectedTimes, setSelectedTimes] = useState<string[]>(() => {
    const slot = client?.preferred_time_slot
    if (!slot) return []
    return slot.split(',').map(s => s.trim()).filter(Boolean)
  })
  const [saving, setSaving] = useState(false)

  // Package modal state
  const [packageModal, setPackageModal] = useState<{
    mode: 'add' | 'edit'
    pkg?: PTPackage
  } | null>(null)

  const toggleDay = (day: string) =>
    setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const toggleTime = (key: string) =>
    setSelectedTimes(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key])

  const activePackages = client?.packages?.filter(p => p.active) || []
  const historyPackages = client?.packages?.filter(p => !p.active) || []

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    const payload = {
      instructor_id: instructorId, name, phone, email, goal: goal || null,
      health_notes: healthNotes, active, source: source || null,
      preferred_days: preferredDays.length > 0 ? preferredDays : null,
      preferred_time_slot: selectedTimes.length > 0 ? selectedTimes.join(',') : null,
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

  // Resolve goal label — fallback to raw value for legacy free-text entries
  const goalLabel = GOALS.find(g => g.key === goal)?.label ?? goal

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-[#0f0f14] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-[420px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center text-sm">🏋️</div>
            <div>
              <div className="text-sm font-semibold text-white">
                {mode === 'add' ? '+ Нов клиент' : client?.name}
              </div>
              <div className="text-[10px] text-white/40">PT Клиент</div>
            </div>
          </div>

          <div className="space-y-3">

            {/* Name */}
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Име *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
            </div>

            {/* Instructor */}
            {userRole !== 'instructor' && (
              <div>
                <label className="text-[11px] text-white/50 mb-1 block">Инструктор</label>
                <select value={instructorId} onChange={e => setInstructorId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-white/50 mb-1 block">Телефон *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+359..."
                  className={`w-full h-9 px-3 rounded-lg bg-white/5 border text-white text-sm placeholder:text-white/20 focus:outline-none ${
                    !phone.trim() ? 'border-red-500/30' : 'border-white/[0.08] focus:border-amber-400/50'
                  }`} />
              </div>
              <div>
                <label className="text-[11px] text-white/50 mb-1 block">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50" />
              </div>
            </div>

            {/* Goal — dropdown with emoji options */}
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Фитнес цел</label>
              <div className="relative">
                <select value={goal} onChange={e => setGoal(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm appearance-none focus:outline-none focus:border-amber-400/50">
                  <option value="">— избери цел —</option>
                  {GOALS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-xs">▾</span>
              </div>
              {goal && (
                <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/20 text-violet-400 text-xs inline-block">
                  {goalLabel}
                </div>
              )}
            </div>

            {/* Source */}
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Откъде разбра за нас</label>
              <div className="relative">
                <select value={source} onChange={e => setSource(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm appearance-none focus:outline-none focus:border-amber-400/50">
                  <option value="">— избери —</option>
                  {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-xs">▾</span>
              </div>
            </div>

            {/* Health notes */}
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Здравни бележки</label>
              <textarea value={healthNotes} onChange={e => setHealthNotes(e.target.value)} rows={2}
                placeholder="Наранявания, противопоказания..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 resize-none" />
            </div>

            {/* Preferred days */}
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

            {/* Preferred time slot — multi-select cards like PTInquiryModal */}
            <div>
              <label className="text-xs text-white/55 mb-2 block">
                Предпочитан час
                <span className="text-white/30 ml-1 text-[11px]">— избери един или повече</span>
              </label>
              <div className="flex flex-col gap-2">
                {TIME_SLOTS.map(ts => {
                  const isActive = selectedTimes.includes(ts.key)
                  return (
                    <button key={ts.key} type="button" onClick={() => toggleTime(ts.key)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        isActive ? 'bg-amber-400/10 border-amber-400/35' : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                      }`}>
                      <span className="text-lg">{ts.emoji}</span>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/75'}`}>{ts.label}</div>
                        <div className="text-xs text-white/35">{ts.range}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold transition-opacity ${
                        isActive ? 'bg-amber-400/20 border-amber-400/40 text-amber-400 opacity-100' : 'opacity-0'
                      }`}>✓</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active toggle (edit only) */}
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

          {/* Packages section — edit mode only */}
          {mode === 'edit' && client && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-3">Пакети</div>

              {/* Active packages */}
              {activePackages.length === 0 && (
                <div className="text-[11px] text-white/25 text-center py-3 border border-dashed border-white/[0.06] rounded-xl mb-2">
                  Без активен пакет
                </div>
              )}
              {activePackages.map(pkg => {
                const rem = pkg.total_sessions - pkg.used_sessions
                const pct = Math.max(2, (pkg.used_sessions / pkg.total_sessions) * 100)
                return (
                  <div key={pkg.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Активен</span>
                        <span className="text-xs font-semibold text-white">
                          {pkg.total_sessions} сесии{pkg.price_total ? ` · €${pkg.price_total}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => setPackageModal({ mode: 'edit', pkg })}
                        className="text-[10px] px-2 py-1 rounded-lg bg-amber-400/8 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 transition-colors">
                        ✏️ Редактирай
                      </button>
                    </div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/50">Оставащи</span>
                      <span className={`font-semibold ${rem <= 2 ? 'text-red-400' : 'text-white'}`}>
                        {rem} / {pkg.total_sessions}{rem <= 2 ? ' ⚠️' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${rem <= 2 ? 'bg-red-400' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                      {pkg.expires_at && (
                        <span className={new Date(pkg.expires_at) < new Date(Date.now() + 14 * 86400000) ? 'text-amber-400/70' : ''}>
                          До {new Date(pkg.expires_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add new package */}
              <button
                onClick={() => setPackageModal({ mode: 'add' })}
                className="w-full py-2 rounded-xl border border-dashed border-white/[0.08] text-[11px] text-white/35 hover:text-amber-400/60 hover:border-amber-400/20 transition-colors flex items-center justify-center gap-1.5">
                ＋ Нов пакет
              </button>

              {/* History */}
              {historyPackages.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-[9px] text-white/20 uppercase tracking-wider font-semibold mb-1.5">История</div>
                  {historyPackages.map(pkg => (
                    <div key={pkg.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 flex justify-between">
                      <div>
                        <span className="text-xs text-white/35">{pkg.total_sessions} сесии</span>
                        {pkg.purchased_at && (
                          <span className="text-[10px] text-white/20 ml-2">
                            {new Date(pkg.purchased_at).toLocaleDateString('bg-BG', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div>
                        {pkg.price_total && <span className="text-[10px] text-white/25">€{pkg.price_total}</span>}
                        <span className="text-[10px] text-white/20 ml-2">{pkg.used_sessions} изп.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
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

      {/* PTPackageModal — rendered outside the scrollable container, z-[60] */}
      {packageModal && client && (
        <PTPackageModal
          mode={packageModal.mode}
          client={client}
          pkg={packageModal.pkg}
          onClose={() => setPackageModal(null)}
          onSaved={() => { setPackageModal(null); onSaved() }}
        />
      )}
    </>
  )
}
