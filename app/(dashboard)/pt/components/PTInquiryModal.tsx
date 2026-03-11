// app/(dashboard)/pt/components/PTInquiryModal.tsx
'use client'

import { useState } from 'react'
import { Instructor } from '../page'

interface Props {
  instructors: Instructor[]
  userRole: string
  userName: string
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

function validateBGPhone(phone: string): boolean {
  const clean = phone.replace(/[\s\-().]/g, '')
  if (/^08\d{8}$/.test(clean)) return true
  if (/^\+3598\d{8}$/.test(clean)) return true
  return false
}

export default function PTInquiryModal({ instructors, userRole, userName, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredDays, setPreferredDays] = useState<string[]>([])
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [goal, setGoal] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const toggleDay = (day: string) =>
    setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  function toggleTime(key: string) {
    setSelectedTimes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (!phone.trim()) { setPhoneError('Телефонът е задължителен'); return }
    if (phone && !validateBGPhone(phone)) {
      setPhoneError('Невалиден БГ номер')
      return
    }
    setSaving(true)
    await fetch('/api/pt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_inquiry',
        name,
        phone,
        preferred_days: preferredDays.length ? preferredDays : null,
        preferred_time_slot: selectedTimes.length ? selectedTimes.join(',') : null,
        goal: goal || null,
        source: source || null,
        notes: notes || null,
        assigned_to: assignedTo || null,
        created_by: userName,
      })
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-[400px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center text-sm">📞</div>
          <div>
            <div className="text-sm font-semibold text-white">Ново запитване</div>
            <div className="text-[10px] text-white/40">Потенциален PT клиент</div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Име *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
              className={`w-full h-9 px-3 rounded-lg bg-white/5 border text-white text-sm placeholder:text-white/20 focus:outline-none ${
                !name.trim() ? 'border-white/[0.08]' : 'border-amber-400/30 focus:border-amber-400/50'
              }`} />
          </div>

          {/* Phone (required) */}
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Телефон *</label>
            <input
              type="text"
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneError('') }}
              onBlur={() => {
                if (phone && !validateBGPhone(phone)) {
                  setPhoneError('Невалиден БГ номер (напр. 0888123456 или +359888123456)')
                }
              }}
              placeholder="0888 123 456"
              className="w-full bg-white/[0.05] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50 border-white/10"
              style={{ borderColor: phoneError ? 'rgba(248,113,113,0.6)' : undefined }}
            />
            {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
          </div>

          {/* Preferred days */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Предпочитани дни</label>
            <div className="flex gap-1">
              {DAYS_BG.map(d => (
                <button key={d.value} onClick={() => toggleDay(d.value)}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium border transition-all ${
                    preferredDays.includes(d.value)
                      ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred time slot — multi-select */}
          <div>
            <label className="text-xs text-white/55 mb-2 block">
              Предпочитан час
              <span className="text-white/30 ml-1 text-[11px]">— избери един или повече</span>
            </label>
            <div className="flex flex-col gap-2">
              {TIME_SLOTS.map(ts => {
                const active = selectedTimes.includes(ts.key)
                return (
                  <button
                    key={ts.key}
                    type="button"
                    onClick={() => toggleTime(ts.key)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-sky-400/10 border-sky-400/35'
                        : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg">{ts.emoji}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${active ? 'text-white' : 'text-white/75'}`}>{ts.label}</div>
                      <div className="text-xs text-white/35">{ts.range}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold transition-opacity ${
                      active ? 'bg-sky-400/20 border-sky-400/40 text-sky-400 opacity-100' : 'opacity-0'
                    }`}>✓</div>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-white/30 mt-2">ℹ️ Можеш да избереш повече от един</p>
          </div>

          {/* Goal dropdown */}
          <div>
            <label className="text-xs text-white/55 mb-1.5 block">Фитнес цел</label>
            <div className="relative">
              <select
                value={goal}
                onChange={e => setGoal(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-amber-400/50"
              >
                <option value="">— избери цел —</option>
                {GOALS.map(g => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-xs">▾</span>
            </div>
            {goal && (
              <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/20 text-violet-400 text-xs">
                {GOALS.find(g => g.key === goal)?.label}
              </div>
            )}
          </div>

          {/* Source dropdown */}
          <div>
            <label className="text-xs text-white/55 mb-1.5 block">Откъде разбра за нас</label>
            <div className="relative">
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-amber-400/50"
              >
                <option value="">— избери —</option>
                {SOURCES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-xs">▾</span>
            </div>
          </div>

          {/* Assign to instructor */}
          {instructors.length > 0 && (
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Насочи към инструктор</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50">
                <option value="">— не е насочено —</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Бележка</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Допълнителна информация..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-xs text-white/50 bg-white/5 border border-white/[0.08]">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()}
            className="flex-1 h-10 rounded-xl text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/15 disabled:opacity-30">
            {saving ? '...' : '📞 Запази запитване'}
          </button>
        </div>
      </div>
    </div>
  )
}
