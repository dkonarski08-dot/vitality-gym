// app/(dashboard)/hall-cash/components/ReceptionistHallView.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { formatDate, formatDateShort } from '@/lib/formatters'

interface HallCashRecord {
  id: string
  date: string
  staff_name: string | null
  cash_turnover: number | null
  system_turnover: number | null
  notes: string | null
  admin_cash_counted: number | null
  alert_physical_diff: boolean
  alert_system_diff: boolean
  alert_seen_by_staff: boolean
}

export function ReceptionistHallView() {
  const { userName } = useSession()
  const [records, setRecords] = useState<HallCashRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cashTurnover, setCashTurnover] = useState('')
  const [systemTurnover, setSystemTurnover] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hall-cash?role=receptionist')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const recs: HallCashRecord[] = data.records || []
      setRecords(recs)

      const todayRec = recs.find(r => r.date === today)
      if (todayRec && todayRec.staff_name) {
        setCashTurnover(todayRec.cash_turnover != null ? String(todayRec.cash_turnover) : '')
        setSystemTurnover(todayRec.system_turnover != null ? String(todayRec.system_turnover) : '')
        setStaffNotes(todayRec.notes || '')
        setSaved(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  const handleStaffSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/hall-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'staff_save',
          date: today,
          staff_name: userName,
          cash_turnover: cashTurnover,
          system_turnover: systemTurnover,
          notes: staffNotes,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSaved(true)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    } finally {
      setSaving(false)
    }
  }

  const handleAckAlert = async (date: string) => {
    try {
      const res = await fetch('/api/hall-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack_alert', date }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Грешка') }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
  }

  const yesterdayRec = records.find(r => r.date === yesterdayStr)
  const hasYesterdayAlert = !!(yesterdayRec &&
    (yesterdayRec.alert_physical_diff || yesterdayRec.alert_system_diff) &&
    !yesterdayRec.alert_seen_by_staff)

  return (
    <div className="p-6 max-w-sm mx-auto">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {hasYesterdayAlert && yesterdayRec && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-red-400 mb-1">⚠️ Разлика от вчера ({formatDateShort(yesterdayStr)})</div>
                  <div className="text-sm text-red-300">
                    Ти: {yesterdayRec.cash_turnover?.toFixed(2)}€ / Admin: {yesterdayRec.admin_cash_counted?.toFixed(2)}€
                  </div>
                </div>
                <button onClick={() => handleAckAlert(yesterdayStr)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/70 border border-white/10 hover:bg-white/15 shrink-0">
                  Видяно ✓
                </button>
              </div>
            </div>
          )}

          <div className={`border rounded-2xl p-5 ${saved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
            <div className="text-xs text-white/50 uppercase tracking-widest mb-5">{formatDate(today)}</div>

            <div className="mb-4">
              <label className="text-xs text-white/70 block mb-1.5">Оборот в брой (€)</label>
              <input type="number" step="0.01" value={cashTurnover}
                onChange={e => { setCashTurnover(e.target.value); setSaved(false) }}
                placeholder="0.00"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-violet-400/50 focus:outline-none placeholder:text-white/20" />
            </div>

            <div className="mb-5">
              <label className="text-xs text-white/70 block mb-1.5">Оборот по система (€)</label>
              <input type="number" step="0.01" value={systemTurnover}
                onChange={e => { setSystemTurnover(e.target.value); setSaved(false) }}
                placeholder="0.00"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-violet-400/50 focus:outline-none placeholder:text-white/20" />
            </div>

            <div className="mb-5">
              <label className="text-xs text-white/70 block mb-1.5">Бележка (по желание)</label>
              <textarea value={staffNotes}
                onChange={e => { setStaffNotes(e.target.value); setSaved(false) }}
                placeholder="Забележка за деня..."
                rows={2}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-violet-400/50 focus:outline-none placeholder:text-white/30 resize-none" />
            </div>

            <button onClick={handleStaffSave}
              disabled={saving || (!cashTurnover && !systemTurnover)}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30'
              }`}>
              {saving ? 'Запазвам...' : saved ? '✓ Записано — натисни за промяна' : 'Запази'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
