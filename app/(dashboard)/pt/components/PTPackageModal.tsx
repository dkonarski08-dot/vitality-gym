// app/(dashboard)/pt/components/PTPackageModal.tsx
'use client'

import { useState } from 'react'
import { PTClient, PTPackage } from '../page'

interface Props {
  mode: 'add' | 'edit'
  client: PTClient
  pkg?: PTPackage          // required when mode === 'edit'
  onClose: () => void
  onSaved: () => void
}

const SESSION_PRESETS = [8, 10, 15, 20, 30]
const DURATION_PRESETS = [30, 60, 90, 180, 365]

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDateBG(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PTPackageModal({ mode, client, pkg, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // For remaining sessions counter (edit only)
  const initialRemaining = pkg ? pkg.total_sessions - pkg.used_sessions : 0
  const [remaining, setRemaining] = useState(initialRemaining)

  const [sessionsPreset, setSessionsPreset] = useState<number | null>(pkg?.total_sessions ?? null)
  const [sessionsCustom, setSessionsCustom] = useState(
    pkg && !SESSION_PRESETS.includes(pkg.total_sessions) ? String(pkg.total_sessions) : ''
  )
  const [price, setPrice] = useState(pkg?.price_total != null ? String(pkg.price_total) : '')
  const [startsOn, setStartsOn] = useState(pkg?.starts_on || pkg?.purchased_at || today)
  const [durationDays, setDurationDays] = useState<string>(pkg?.duration_days ? String(pkg.duration_days) : '')
  const [saving, setSaving] = useState(false)

  const totalSessions = sessionsCustom ? Number(sessionsCustom) : (sessionsPreset ?? 0)
  const expiresAt = startsOn && durationDays ? addDays(startsOn, Number(durationDays)) : ''
  const isValid = totalSessions > 0 && !!price && !!startsOn

  // Clamp remaining when total changes
  const clampedRemaining = Math.min(remaining, totalSessions)

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    const payload = {
      total_sessions: totalSessions,
      price_total: Number(price),
      starts_on: startsOn,
      purchased_at: startsOn,
      duration_days: durationDays ? Number(durationDays) : null,
      expires_at: expiresAt || null,
    }
    if (mode === 'edit' && pkg) {
      await fetch('/api/pt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_package',
          package_id: pkg.id,
          ...payload,
          remaining_sessions: clampedRemaining,
        })
      })
    } else {
      await fetch('/api/pt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_package',
          client_id: client.id,
          instructor_id: client.instructor_id,
          ...payload,
        })
      })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-[400px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center text-sm">📦</div>
          <div>
            <div className="text-sm font-semibold text-white">
              {mode === 'add' ? 'Нов пакет' : 'Редактирай пакет'}
            </div>
            <div className="text-[10px] text-white/40">{client.name}</div>
          </div>
        </div>

        <div className="space-y-3">

          {/* Remaining sessions counter — edit only */}
          {mode === 'edit' && pkg && (
            <div>
              <label className="text-[11px] text-white/50 mb-1.5 block">Оставащи сесии</label>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRemaining(r => Math.max(0, r - 1))}
                    className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xl font-light hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-white">{clampedRemaining}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">от {totalSessions || pkg.total_sessions} общо</div>
                  </div>
                  <button
                    onClick={() => setRemaining(r => Math.min(totalSessions || pkg.total_sessions, r + 1))}
                    className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xl font-light hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-colors flex items-center justify-center"
                  >+</button>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                    style={{ width: `${totalSessions ? (clampedRemaining / totalSessions) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Total sessions */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">
              {mode === 'edit' ? 'Общо сесии в пакета' : 'Брой сесии *'}
            </label>
            <div className="flex gap-1.5 mb-1.5">
              {SESSION_PRESETS.map(n => (
                <button key={n}
                  onClick={() => { setSessionsPreset(n); setSessionsCustom('') }}
                  className={`flex-1 h-8 rounded-lg text-xs border transition-all ${
                    sessionsPreset === n && !sessionsCustom
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      : 'bg-white/5 text-white/50 border-white/[0.08] hover:text-white/70'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <input
              value={sessionsCustom}
              onChange={e => { setSessionsCustom(e.target.value); setSessionsPreset(null) }}
              type="number" min="1" placeholder="Друго число..."
              className={`w-full h-8 px-3 rounded-lg bg-white/5 border text-white text-xs placeholder:text-white/20 focus:outline-none ${
                sessionsCustom ? 'border-amber-400/30' : 'border-white/[0.08]'
              }`}
            />
          </div>

          {/* Price + Start date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Цена (€) *</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" placeholder="0"
                className={`w-full h-9 px-3 rounded-lg bg-white/5 border text-white text-sm placeholder:text-white/20 focus:outline-none ${
                  !price ? 'border-white/[0.08]' : 'border-amber-400/30'
                }`} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Начална дата *</label>
              <input value={startsOn} onChange={e => setStartsOn(e.target.value)} type="date"
                className="w-full h-9 px-2 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-400/50" />
            </div>
          </div>

          {/* Duration in days */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Продължителност (дни)</label>
            <div className="flex items-center gap-3">
              <input
                value={durationDays}
                onChange={e => setDurationDays(e.target.value)}
                type="number" min="1" placeholder="напр. 90"
                className={`w-24 h-9 px-3 rounded-lg bg-white/5 border text-white text-sm text-center placeholder:text-white/20 focus:outline-none ${
                  durationDays ? 'border-amber-400/30' : 'border-white/[0.08]'
                }`}
              />
              <span className="text-xs text-white/40">дни от началната дата</span>
            </div>
            {/* Preset shortcuts */}
            <div className="flex gap-1.5 mt-1.5">
              {DURATION_PRESETS.map(d => (
                <button key={d} onClick={() => setDurationDays(String(d))}
                  className={`px-2 h-6 rounded text-[10px] border transition-all ${
                    durationDays === String(d)
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      : 'bg-white/[0.03] text-white/35 border-white/[0.06] hover:text-white/55'
                  }`}>
                  {d === 30 ? '1м' : d === 60 ? '2м' : d === 90 ? '3м' : d === 180 ? '6м' : '1г'}
                </button>
              ))}
            </div>
            {/* Expiry preview */}
            {expiresAt && (
              <div className="mt-2 text-[10px] text-white/30 flex items-center gap-1">
                <span>⏰ Изтича на:</span>
                <span className="text-amber-400/70">{formatDateBG(expiresAt)}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-xs text-white/50 bg-white/5 border border-white/[0.08]">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving || !isValid}
            className="flex-1 h-10 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 disabled:opacity-30 disabled:cursor-not-allowed">
            {saving ? '...' : mode === 'add' ? '+ Добави пакет' : '✓ Запази пакет'}
          </button>
        </div>

      </div>
    </div>
  )
}
