// app/(dashboard)/hall-cash/page.tsx
// Vitality Hall — Daily Cash
//
// RECEPTIONIST sees: Оборот в брой + Оборот по система + Бележка (only today)
// ADMIN sees: month navigation, receptionist data, admin count, GymRealm import
//
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DatePicker from '@/components/ui/DatePicker'
import { MONTHS_BG, DAYS_BG, formatDate, formatDateShort } from '@/lib/formatters'
import DiffBadge from '@/components/ui/DiffBadge'
import { useSession } from '@/hooks/useSession'
import { useMonthNav } from '@/hooks/useMonthNav'
import { ReceptionistHallView } from './components/ReceptionistHallView'

interface HallCashRecord {
  id: string
  date: string
  staff_name: string | null
  cash_turnover: number | null
  system_turnover: number | null
  notes: string | null
  admin_cash_counted: number | null
  admin_counted_by: string | null
  admin_counted_at: string | null
  gymrealm_cash: number | null
  gymrealm_filename: string | null
  gymrealm_uploaded_at: string | null
  alert_physical_diff: boolean
  alert_system_diff: boolean
  alert_seen_by_staff: boolean
  created_at: string
}

export default function HallCashPage() {
  const { userRole, userName } = useSession()
  const [records, setRecords] = useState<HallCashRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Receptionist form
  const [cashTurnover, setCashTurnover] = useState('')
  const [systemTurnover, setSystemTurnover] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Admin fields — NOT in loadData deps
  const [adminDate, setAdminDate] = useState(() => new Date().toISOString().split('T')[0])
  const [adminCounted, setAdminCounted] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminSaved, setAdminSaved] = useState(false)

  // GymRealm import
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  // Month navigation — admin only
  const { viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth, goToPrevMonth, goToNextMonth, resetToMonth } = useMonthNav(
    (newYear, newMonth) => {
      const now = new Date()
      const isNowCurrent = newYear === now.getFullYear() && newMonth === now.getMonth()
      const newLastDay = new Date(newYear, newMonth + 1, 0).getDate()
      const newMonthEnd = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(newLastDay).padStart(2, '0')}`
      setAdminDate(isNowCurrent ? now.toISOString().split('T')[0] : newMonthEnd)
      setAdminCounted('')
      setAdminSaved(false)
    }
  )

  const loadData = useCallback(async (dateForAdmin?: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/hall-cash?role=${userRole}&from=${monthStart}&to=${monthEnd}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const recs: HallCashRecord[] = data.records || []
      setRecords(recs)

      // Pre-fill receptionist form from today (only when viewing current month)
      // W5: only set saved=true if receptionist actually entered data (staff_name set)
      const nowMonth = new Date().getMonth()
      const nowYear = new Date().getFullYear()
      if (viewMonth === nowMonth && viewYear === nowYear) {
        const todayRec = recs.find(r => r.date === today)
        if (todayRec && todayRec.staff_name) {
          setCashTurnover(todayRec.cash_turnover != null ? String(todayRec.cash_turnover) : '')
          setSystemTurnover(todayRec.system_turnover != null ? String(todayRec.system_turnover) : '')
          setStaffNotes(todayRec.notes || '')
          setSaved(true)
        }
      }

      if (dateForAdmin) {
        const rec = recs.find(r => r.date === dateForAdmin)
        setAdminCounted(rec?.admin_cash_counted != null ? String(rec.admin_cash_counted) : '')
        setAdminSaved(rec?.admin_cash_counted != null) // W1: ?? false was dead code
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [today, userRole, monthStart, monthEnd, viewMonth, viewYear])

  useEffect(() => { loadData(adminDate) }, [loadData]) // eslint-disable-line

  // Admin date change — lookup in loaded records, no fetch
  const handleAdminDateChange = (newDate: string) => {
    setAdminDate(newDate)
    setAdminSaved(false)
    const rec = records.find(r => r.date === newDate)
    setAdminCounted(rec?.admin_cash_counted != null ? String(rec.admin_cash_counted) : '')
    setAdminSaved(rec?.admin_cash_counted != null) // W1: ?? false was dead code
  }

  const handleStaffSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/hall-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'staff_save', date: today, staff_name: userName,
          cash_turnover: cashTurnover, system_turnover: systemTurnover, notes: staffNotes,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSaved(true)
      await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка') }
    finally { setSaving(false) }
  }

  const handleAdminSave = async () => {
    setAdminSaving(true)
    try {
      const res = await fetch('/api/hall-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_count', date: adminDate,
          admin_cash_counted: adminCounted, admin_counted_by: userName,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setAdminSaved(true)
      await loadData(adminDate)
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка') }
    finally { setAdminSaving(false) }
  }

  // GymRealm import — reads ALL days from xlsx, writes only gymrealm_cash
  const handleImport = async () => {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve((r.result as string).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(importFile)
      })
      const res = await fetch('/api/hall-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gymrealm_import', fileBase64: base64, filename: importFile.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportResult(
        data.daysImported > 0
          ? `✅ Записани ${data.daysImported} дня (${data.rows} реда в файла)`
          : `⚠️ Обработен (${data.rows} реда), но не бяха намерени дати. Провери формата.`
      )
      setImportFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadData(adminDate)
    } catch (err) { setImportResult(`❌ ${err instanceof Error ? err.message : 'Грешка'}`) }
    finally { setImporting(false) }
  }

  const handleAckAlert = async (date: string) => {
    try {
      const res = await fetch('/api/hall-cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack_alert', date }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Грешка') } // W6
      await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка') }
  }

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdayRec = records.find(r => r.date === yesterdayStr)
  const hasYesterdayAlert = yesterdayRec &&
    (yesterdayRec.alert_physical_diff || yesterdayRec.alert_system_diff) &&
    !yesterdayRec.alert_seen_by_staff

  const alertRecords = records.filter(r => r.alert_physical_diff || r.alert_system_diff)
  const adminRec = records.find(r => r.date === adminDate)
  const adminNumVal = parseFloat(adminCounted) || 0
  const grDiff = adminRec?.gymrealm_cash != null && adminRec?.cash_turnover != null
    ? adminRec.cash_turnover - adminRec.gymrealm_cash : null

  // ══════════════ RECEPTIONIST VIEW ══════════════
  if (userRole !== 'admin') {
    return <ReceptionistHallView />
  }

  // ══════════════ ADMIN VIEW ══════════════
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <h1 className="text-lg font-bold text-white">Дневна каса — Зала</h1>
        <p className="text-sm text-white/60 mt-0.5">{formatDate(today)}</p>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={goToPrevMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
            ‹
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-white">{MONTHS_BG[viewMonth]} {viewYear}</div>
            {!isCurrentMonth && (
              <button onClick={() => {
                const now = new Date()
                resetToMonth(now.getFullYear(), now.getMonth())
              }} className="text-xs text-violet-400/70 hover:text-violet-400 mt-0.5">→ Текущ месец</button>
            )}
          </div>
          <button onClick={goToNextMonth} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
            ›
          </button>
        </div>

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

            {/* KPI */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Аномалии</div>
                <div className={`text-2xl font-bold ${alertRecords.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {alertRecords.length}
                </div>
                <div className="text-xs text-white/30 mt-0.5">несъвпадения</div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Дни с данни</div>
                <div className="text-2xl font-bold text-violet-400">{records.filter(r => r.cash_turnover != null).length}</div>
                <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">GymRealm импорти</div>
                <div className="text-2xl font-bold text-white">{records.filter(r => r.gymrealm_cash != null).length}</div>
                <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Admin physical count */}
              <div className={`border rounded-2xl p-5 ${adminSaved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
                <div className="text-xs text-white/50 uppercase tracking-widest mb-4">Проверка на касата</div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <DatePicker label="Дата" value={adminDate} min={monthStart} max={isCurrentMonth ? today : monthEnd} onChange={handleAdminDateChange} />
                  <div>
                    <label className="text-xs text-white/70 block mb-1.5">Преброена сума (€)</label>
                    <input type="number" step="0.01" value={adminCounted}
                      onChange={e => { setAdminCounted(e.target.value); setAdminSaved(false) }}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-lg font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30" />
                  </div>
                </div>

                {adminRec && (adminRec.cash_turnover != null || adminRec.system_turnover != null) && (
                  <div className="bg-white/[0.04] rounded-xl p-3 mb-4 space-y-2 text-sm">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Данни от рецепция — {adminRec.staff_name}</div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Оборот в брой</span>
                      <span className="font-semibold text-white">{adminRec.cash_turnover?.toFixed(2) ?? '—'}€</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Оборот по система</span>
                      <span className="font-semibold text-white">{adminRec.system_turnover?.toFixed(2) ?? '—'}€</span>
                    </div>
                    {adminRec.notes && (
                      <div className="text-xs text-white/40 italic border-t border-white/[0.06] pt-2">{adminRec.notes}</div>
                    )}
                    {adminCounted && adminRec.cash_turnover != null && (
                      <div className="border-t border-white/[0.06] pt-2 flex justify-between">
                        <span className="text-white/60">Разлика (преброени vs в брой)</span>
                        <DiffBadge a={adminNumVal} b={adminRec.cash_turnover} />
                      </div>
                    )}
                    {adminRec.gymrealm_cash != null && (
                      <div className="flex justify-between border-t border-white/[0.06] pt-2">
                        <span className="text-white/60">GymRealm в брой</span>
                        <span className="font-semibold text-violet-400">{adminRec.gymrealm_cash.toFixed(2)}€</span>
                      </div>
                    )}
                    {grDiff != null && (
                      <div className="flex justify-between">
                        <span className="text-white/40 text-xs">Разлика (в брой vs GymRealm)</span>
                        <DiffBadge a={adminRec.cash_turnover} b={adminRec.gymrealm_cash} />
                      </div>
                    )}
                  </div>
                )}

                {!adminRec && (
                  <div className="text-center text-sm text-white/30 py-4 mb-4">Няма данни за {formatDateShort(adminDate)}</div>
                )}

                <button onClick={handleAdminSave} disabled={adminSaving || !adminCounted}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${
                    adminSaved
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  }`}>
                  {adminSaving ? '...' : adminSaved ? '✓ Записано' : 'Запази броенето'}
                </button>
              </div>

              {/* GymRealm import */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                <div className="text-xs text-white/50 uppercase tracking-widest mb-1">GymRealm — Дневен отчет</div>
                <p className="text-xs text-white/30 mb-4">
                  Качи отчета — ще запише данните за <span className="text-violet-400 font-medium">всички дни</span> от файла. Не променя ръчно въведените данни.
                </p>

                <label
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors mb-3 ${
                    dragOver ? 'border-violet-500 bg-violet-500/10'
                    : importFile ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-white/15 hover:border-white/25'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setImportFile(f); setImportResult(null) } }}>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null) } }} />
                  <span className="text-xl">{importFile ? '📄' : '📁'}</span>
                  <span className="text-sm text-white/40">{importFile ? importFile.name : 'Избери или провлачи .xlsx'}</span>
                </label>

                {importResult && (
                  <div className={`text-sm p-3 rounded-xl mb-3 ${
                    importResult.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : importResult.startsWith('⚠️') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>{importResult}</div>
                )}

                <button onClick={handleImport} disabled={importing || !importFile}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-30 transition-colors">
                  {importing ? '⏳ Обработвам...' : '📥 Импортирай'}
                </button>
              </div>
            </div>

            {/* Alerts */}
            {alertRecords.length > 0 && (
              <div className="mb-6">
                <div className="text-xs text-red-400 uppercase tracking-widest mb-3">⚠️ Аномалии</div>
                <div className="space-y-2">
                  {alertRecords.slice(0, 10).map(r => (
                    <div key={r.id} className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white font-medium">{formatDateShort(r.date)} — {r.staff_name}</div>
                        {r.cash_turnover != null && r.admin_cash_counted != null && (
                          <div className="text-xs text-red-400 mt-0.5">
                            Рецепция: {r.cash_turnover.toFixed(2)}€ / Admin: {r.admin_cash_counted.toFixed(2)}€
                            {' '}(разлика: {(r.admin_cash_counted - r.cash_turnover).toFixed(2)}€)
                          </div>
                        )}
                        {r.notes && <div className="text-xs text-white/40 mt-0.5 italic">{r.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History table */}
            <div className="text-xs text-white/50 uppercase tracking-widest mb-3">История — {MONTHS_BG[viewMonth]} {viewYear}</div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 gap-1 px-4 py-2.5 bg-white/[0.03] text-xs text-white/40 uppercase tracking-wider">
                <div>Дата</div>
                <div>Служител</div>
                <div className="text-right">В брой</div>
                <div className="text-right">По система</div>
                <div className="text-right">Преброени</div>
                <div className="text-right">GymRealm</div>
                <div className="text-right">Разлика</div>
              </div>
              {records.map(r => {
                const isSelected = r.date === adminDate
                const hasAlert = r.alert_physical_diff || r.alert_system_diff
                const isToday = r.date === today
                return (
                  <div key={r.id}
                    onClick={() => handleAdminDateChange(r.date)}
                    className={`grid grid-cols-7 gap-1 px-4 py-2.5 border-t border-white/[0.06] text-sm items-center cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      isSelected ? 'bg-violet-500/[0.06] border-l-2 border-l-violet-500/40'
                      : hasAlert ? 'bg-red-500/[0.04]'
                      : isToday ? 'bg-violet-500/[0.02]'
                      : ''
                    }`}>
                    <div className="text-white/70 flex items-center gap-1">
                      {formatDateShort(r.date)}
                      {hasAlert && <span className="text-red-400 text-xs">⚠</span>}
                      {isToday && <span className="text-violet-400 text-xs">●</span>}
                    </div>
                    <div className="text-white/50 truncate text-xs">{r.staff_name || '—'}</div>
                    <div className="text-right font-medium text-white/80">{r.cash_turnover?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
                    <div className="text-right text-white/60">{r.system_turnover?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
                    <div className={`text-right font-medium ${r.admin_cash_counted != null ? (r.alert_physical_diff ? 'text-red-400' : 'text-emerald-400') : 'text-white/20'}`}>
                      {r.admin_cash_counted?.toFixed(2) ?? '—'}
                    </div>
                    <div className="text-right text-violet-400">{r.gymrealm_cash?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
                    <div className="text-right">
                      <DiffBadge a={r.admin_cash_counted} b={r.cash_turnover} />
                    </div>
                  </div>
                )
              })}
              {records.length === 0 && (
                <div className="text-center text-white/30 py-10 text-sm">Няма записи за {MONTHS_BG[viewMonth]} {viewYear}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
