# Cash Page Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `app/(dashboard)/cash/page.tsx` (626 lines) into focused files matching the pattern used in `/shifts` and `/requests`.

**Architecture:** Extract `CashRecord` interface to `types.ts`, all state+handlers to `hooks/useCash.ts`, each UI section to a component in `components/`. Page becomes a ~30-line composition shell that routes between receptionist and admin paths. Zero behavior changes.

**Tech Stack:** Next.js 14, React, TypeScript strict, Tailwind CSS, xlsx (already installed)

---

## Reference: Current File Map

`app/(dashboard)/cash/page.tsx`:
- Lines 1–39: imports + `CashRecord` interface
- Lines 41–112: state declarations + `loadData` + `useEffect`
- Lines 114–281: handlers (handleAdminDateChange, handleStaffSave, handleAdminSave, handleImport, handleAckAlert)
- Lines 283–291: derived values (yesterday alert, alertRecords, recordsWithData)
- Lines 293–380: JSX — receptionist render path
- Lines 382–625: JSX — admin render path (month nav, KPI cards, count panel, import panel, alerts, history table)

---

### Task 1: Create `types.ts`

**Files:**
- Create: `app/(dashboard)/cash/types.ts`

**Step 1: Create the file**

```typescript
// app/(dashboard)/cash/types.ts

export interface CashRecord {
  id: string
  date: string
  staff_name: string
  gym_cash_system: number | null
  gym_cash_counted: number | null
  notes: string | null
  admin_cash_counted: number | null
  admin_counted_by: string | null
  admin_counted_at: string | null
  gymrealm_gym_cash: number | null
  gymrealm_uploaded_at: string | null
  alert_physical_diff: boolean
  alert_system_diff: boolean
  alert_seen_by_staff: boolean
  created_at: string
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -10`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/cash/types.ts"
git commit -m "refactor(cash): extract CashRecord type"
```

---

### Task 2: Create `hooks/useCash.ts`

**Files:**
- Create: `app/(dashboard)/cash/hooks/useCash.ts`

**Step 1: Create the directory and file**

```typescript
// app/(dashboard)/cash/hooks/useCash.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useSession } from '@/hooks/useSession'
import { useMonthNav } from '@/hooks/useMonthNav'
import { CashRecord } from '../types'

export function useCash() {
  const { userRole, userName } = useSession()
  const [records, setRecords] = useState<CashRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Receptionist fields
  const [gymSystem, setGymSystem] = useState('')
  const [gymCounted, setGymCounted] = useState('')
  const [notes, setNotes] = useState('')

  // Admin fields
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
    setLoading(true)
    try {
      const res = await fetch(`/api/cash?role=${userRole}&from=${monthStart}&to=${monthEnd}`)
      const data = await res.json()
      const recs: CashRecord[] = data.records || []
      setRecords(recs)

      const nowMonth = new Date().getMonth()
      const nowYear = new Date().getFullYear()
      if (viewMonth === nowMonth && viewYear === nowYear) {
        const todayRec = recs.find(r => r.date === today)
        if (todayRec && todayRec.staff_name !== '—') {
          setGymSystem(todayRec.gym_cash_system != null ? String(todayRec.gym_cash_system) : '')
          setGymCounted(todayRec.gym_cash_counted != null ? String(todayRec.gym_cash_counted) : '')
          setNotes(todayRec.notes || '')
          setSaved(true)
        }
      }

      if (userRole === 'admin' && dateForAdmin) {
        const dateRec = recs.find(r => r.date === dateForAdmin)
        setAdminCounted(dateRec?.admin_cash_counted != null ? String(dateRec.admin_cash_counted) : '')
        setAdminSaved(dateRec?.admin_cash_counted != null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане')
    }
    setLoading(false)
  }, [userRole, today, monthStart, monthEnd, viewMonth, viewYear])

  useEffect(() => { loadData(adminDate) }, [loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdminDateChange = (newDate: string) => {
    setAdminDate(newDate)
    setAdminSaved(false)
    const rec = records.find(r => r.date === newDate)
    setAdminCounted(rec?.admin_cash_counted != null ? String(rec.admin_cash_counted) : '')
    setAdminSaved(rec?.admin_cash_counted != null)
  }

  const handleStaffSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'staff_save',
          staff_name: userName,
          date: today,
          gym_cash_system: gymSystem,
          gym_cash_counted: gymCounted,
          hall_cash_system: null,
          hall_cash_counted: null,
          deposit: null,
          notes,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSaved(true)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
    setSaving(false)
  }

  const handleAdminSave = async () => {
    setAdminSaving(true)
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_count',
          date: adminDate,
          admin_cash_counted: adminCounted,
          admin_counted_by: userName,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setAdminSaved(true)
      await loadData(adminDate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
    setAdminSaving(false)
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    try {
      const arrayBuffer = await importFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const headers = rows.length > 0 ? Object.keys(rows[0]) : []

      const dateKey = headers.find(h => {
        const l = h.toLowerCase()
        return l.includes('дата') || l.includes('date') || l.includes('ден')
      })
      const cashKey = headers.find(h => {
        const l = h.toLowerCase()
        return l.includes('в брой') || l === 'cash' || l.includes('брой')
      })

      type DayEntry = { date: string; gymrealm_gym_cash: number | null }
      const entries: DayEntry[] = []

      if (dateKey && cashKey) {
        for (const row of rows) {
          const rawDate = row[dateKey]
          const rawCash = row[cashKey]

          let parsedDate: string | null = null
          if (rawDate instanceof Date) {
            parsedDate = rawDate.toISOString().split('T')[0]
          } else {
            const s = String(rawDate).trim()
            const dmyMatch = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
            const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
            else if (ymdMatch) parsedDate = s
            else if (/^\d{5}$/.test(s)) {
              const d = new Date((parseInt(s) - 25569) * 86400000)
              parsedDate = d.toISOString().split('T')[0]
            }
          }
          if (!parsedDate) continue

          const cashNum = parseFloat(String(rawCash).replace(',', '.').replace(/\s/g, ''))
          entries.push({ date: parsedDate, gymrealm_gym_cash: isNaN(cashNum) || cashNum <= 0 ? null : cashNum })
        }
      } else {
        for (const row of rows) {
          let parsedDate: string | null = null
          let cashAmount: number | null = null
          for (const [key, val] of Object.entries(row)) {
            const s = String(val).trim()
            if (!parsedDate) {
              const dmyMatch = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
              const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
              if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
              else if (ymdMatch) parsedDate = s
            }
            const kl = key.toLowerCase()
            if (!cashAmount && (kl.includes('брой') || kl.includes('cash'))) {
              const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
              if (!isNaN(n) && n > 0) cashAmount = n
            }
          }
          if (parsedDate) entries.push({ date: parsedDate, gymrealm_gym_cash: cashAmount })
        }
      }

      if (entries.length === 0) {
        setImportResult(`⚠️ Обработен (${rows.length} реда), но не бяха намерени дати. Провери формата.`)
        setImporting(false); return
      }

      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gymrealm_import', entries, filename: importFile.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setImportResult(`✅ Записани ${entries.length} дня (${rows.length} реда в файла)`)
      setImportFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadData(adminDate)
    } catch (err) {
      setImportResult(`❌ ${err instanceof Error ? err.message : 'Грешка'}`)
    }
    setImporting(false)
  }

  const handleAckAlert = async (date: string) => {
    try {
      const res = await fetch('/api/cash', {
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

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdayRec = records.find(r => r.date === yesterdayStr)
  const hasYesterdayAlert = !!(yesterdayRec &&
    (yesterdayRec.alert_physical_diff || yesterdayRec.alert_system_diff) &&
    !yesterdayRec.alert_seen_by_staff)

  const alertRecords = records.filter(r => r.alert_physical_diff || r.alert_system_diff)
  const recordsWithData = records.filter(r => r.gym_cash_counted != null)

  const adminRec = records.find(r => r.date === adminDate)
  const grDiff = adminRec?.gymrealm_gym_cash != null && adminRec?.gym_cash_counted != null
    ? adminRec.gym_cash_counted - adminRec.gymrealm_gym_cash : null

  return {
    userRole, loading, error, setError,
    // receptionist
    records, saving, saved, setSaved,
    gymSystem, setGymSystem, gymCounted, setGymCounted, notes, setNotes,
    // admin
    adminDate, adminCounted, setAdminCounted, adminSaving, adminSaved,
    // import
    importFile, setImportFile, importing, importResult, dragOver, setDragOver, fileInputRef,
    // month nav
    viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth,
    goToPrevMonth, goToNextMonth, resetToMonth,
    // derived
    today, yesterdayStr, yesterdayRec, hasYesterdayAlert,
    alertRecords, recordsWithData, adminRec, grDiff,
    // handlers
    handleStaffSave, handleAdminSave, handleImport, handleAckAlert, handleAdminDateChange,
  }
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/cash/hooks/useCash.ts"
git commit -m "refactor(cash): extract useCash hook"
```

---

### Task 3: Create `CashHeader` and `ReceptionistView` components

**Files:**
- Create: `app/(dashboard)/cash/components/CashHeader.tsx`
- Create: `app/(dashboard)/cash/components/ReceptionistView.tsx`

**Step 1: Create `CashHeader.tsx`**

```tsx
// app/(dashboard)/cash/components/CashHeader.tsx

interface Props {
  title: string
  subtitle: string
  saved?: boolean
}

export function CashHeader({ title, subtitle, saved }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
        </div>
        {saved && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ Записано
          </span>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create `ReceptionistView.tsx`**

```tsx
// app/(dashboard)/cash/components/ReceptionistView.tsx
import { CashRecord } from '../types'
import { CashHeader } from './CashHeader'
import { formatDate, formatDateShort } from '@/lib/formatters'

interface Props {
  today: string
  saved: boolean
  setSaved: (v: boolean) => void
  saving: boolean
  error: string | null
  setError: (v: string | null) => void
  gymSystem: string
  setGymSystem: (v: string) => void
  gymCounted: string
  setGymCounted: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  hasYesterdayAlert: boolean
  yesterdayStr: string
  yesterdayRec: CashRecord | undefined
  loading: boolean
  onSave: () => void
  onAckAlert: (date: string) => void
}

export function ReceptionistView({
  today, saved, setSaved, saving, error, setError,
  gymSystem, setGymSystem, gymCounted, setGymCounted,
  notes, setNotes, hasYesterdayAlert, yesterdayStr, yesterdayRec,
  loading, onSave, onAckAlert,
}: Props) {
  return (
    <div className="min-h-screen">
      <CashHeader title="Дневна каса — Фитнес" subtitle={formatDate(today)} saved={saved} />

      <div className="p-6 max-w-sm mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
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
                      Ти: {yesterdayRec.gym_cash_counted?.toFixed(2)}€ / Admin: {yesterdayRec.admin_cash_counted?.toFixed(2)}€
                    </div>
                  </div>
                  <button onClick={() => onAckAlert(yesterdayStr)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/70 border border-white/10 hover:bg-white/15 shrink-0">
                    Видяно ✓
                  </button>
                </div>
              </div>
            )}

            <div className={`border rounded-2xl p-5 ${saved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
              <div className="text-xs text-white/50 uppercase tracking-widest mb-5">{formatDate(today)}</div>
              <div className="mb-4">
                <label className="text-xs text-white/70 block mb-1.5">По система (€)</label>
                <input type="number" step="0.01" value={gymSystem}
                  onChange={e => { setGymSystem(e.target.value); setSaved(false) }}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/20" />
              </div>

              <div className="mb-5">
                <label className="text-xs text-white/70 block mb-1.5">Преброени (€)</label>
                <input type="number" step="0.01" value={gymCounted}
                  onChange={e => { setGymCounted(e.target.value); setSaved(false) }}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/20" />
              </div>

              <div className="mb-5">
                <label className="text-xs text-white/70 block mb-1.5">Бележка (по желание)</label>
                <textarea value={notes}
                  onChange={e => { setNotes(e.target.value); setSaved(false) }}
                  placeholder="Забележка за деня..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-amber-400/50 focus:outline-none placeholder:text-white/30 resize-none" />
              </div>

              <button onClick={onSave}
                disabled={saving || (!gymSystem && !gymCounted)}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${
                  saved
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                }`}>
                {saving ? 'Запазвам...' : saved ? '✓ Записано — натисни за промяна' : 'Запази'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 4: Commit**

```bash
git add "app/(dashboard)/cash/components/"
git commit -m "refactor(cash): add CashHeader and ReceptionistView components"
```

---

### Task 4: Create admin components

**Files:**
- Create: `app/(dashboard)/cash/components/AdminKpiCards.tsx`
- Create: `app/(dashboard)/cash/components/AdminCountPanel.tsx`
- Create: `app/(dashboard)/cash/components/GymRealmImportPanel.tsx`
- Create: `app/(dashboard)/cash/components/AlertsSection.tsx`
- Create: `app/(dashboard)/cash/components/CashHistoryTable.tsx`

**Step 1: Create `AdminKpiCards.tsx`**

```tsx
// app/(dashboard)/cash/components/AdminKpiCards.tsx
import { MONTHS_BG } from '@/lib/formatters'

interface Props {
  alertCount: number
  recordsWithDataCount: number
  gymrealmImportCount: number
  viewMonth: number
}

export function AdminKpiCards({ alertCount, recordsWithDataCount, gymrealmImportCount, viewMonth }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Аномалии</div>
        <div className={`text-2xl font-bold ${alertCount === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {alertCount}
        </div>
        <div className="text-xs text-white/30 mt-0.5">несъвпадения</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Дни с данни</div>
        <div className="text-2xl font-bold text-amber-400">{recordsWithDataCount}</div>
        <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">GymRealm импорти</div>
        <div className="text-2xl font-bold text-white">{gymrealmImportCount}</div>
        <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
      </div>
    </div>
  )
}
```

**Step 2: Create `AdminCountPanel.tsx`**

```tsx
// app/(dashboard)/cash/components/AdminCountPanel.tsx
import DatePicker from '@/components/ui/DatePicker'
import DiffBadge from '@/components/ui/DiffBadge'
import { formatDateShort } from '@/lib/formatters'
import { CashRecord } from '../types'

interface Props {
  adminDate: string
  adminCounted: string
  setAdminCounted: (v: string) => void
  adminSaving: boolean
  adminSaved: boolean
  adminRec: CashRecord | undefined
  grDiff: number | null
  monthStart: string
  monthEnd: string
  today: string
  isCurrentMonth: boolean
  onDateChange: (date: string) => void
  onSave: () => void
}

export function AdminCountPanel({
  adminDate, adminCounted, setAdminCounted, adminSaving, adminSaved,
  adminRec, grDiff, monthStart, monthEnd, today, isCurrentMonth,
  onDateChange, onSave,
}: Props) {
  const adminNumVal = parseFloat(adminCounted) || 0

  return (
    <div className={`border rounded-2xl p-5 ${adminSaved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-4">Проверка на касата</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <DatePicker label="Дата" value={adminDate} min={monthStart} max={isCurrentMonth ? today : monthEnd} onChange={onDateChange} />
        <div>
          <label className="text-xs text-white/70 block mb-1.5">Преброена сума (€)</label>
          <input type="number" step="0.01" value={adminCounted}
            onChange={e => { setAdminCounted(e.target.value); }}
            placeholder="0.00"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-lg font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30" />
        </div>
      </div>

      {adminRec && (adminRec.gym_cash_system != null || adminRec.gym_cash_counted != null) && (
        <div className="bg-white/[0.04] rounded-xl p-3 mb-4 space-y-2 text-sm">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Данни от рецепция — {adminRec.staff_name}</div>
          <div className="flex justify-between">
            <span className="text-white/60">По система</span>
            <span className="font-semibold text-white">{adminRec.gym_cash_system?.toFixed(2) ?? '—'}€</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Преброени</span>
            <span className="font-semibold text-white">{adminRec.gym_cash_counted?.toFixed(2) ?? '—'}€</span>
          </div>
          {adminRec.notes && (
            <div className="text-xs text-white/40 italic border-t border-white/[0.06] pt-2">{adminRec.notes}</div>
          )}
          {adminCounted && adminRec.gym_cash_counted != null && (
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/60">Разлика (преброени vs рецепция)</span>
              <DiffBadge a={adminNumVal} b={adminRec.gym_cash_counted} />
            </div>
          )}
          {adminRec.gymrealm_gym_cash != null && (
            <div className="flex justify-between border-t border-white/[0.06] pt-2">
              <span className="text-white/60">GymRealm в брой</span>
              <span className="font-semibold text-amber-400">{adminRec.gymrealm_gym_cash.toFixed(2)}€</span>
            </div>
          )}
          {grDiff != null && (
            <div className="flex justify-between">
              <span className="text-white/40 text-xs">Разлика (преброени vs GymRealm)</span>
              <DiffBadge a={adminRec.gym_cash_counted} b={adminRec.gymrealm_gym_cash} />
            </div>
          )}
        </div>
      )}

      {!adminRec && (
        <div className="text-center text-sm text-white/30 py-4 mb-4">Няма данни за {formatDateShort(adminDate)}</div>
      )}

      <button onClick={onSave} disabled={adminSaving || !adminCounted}
        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${
          adminSaved
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
        }`}>
        {adminSaving ? '...' : adminSaved ? '✓ Записано' : 'Запази броенето'}
      </button>
    </div>
  )
}
```

**Step 3: Create `GymRealmImportPanel.tsx`**

```tsx
// app/(dashboard)/cash/components/GymRealmImportPanel.tsx
import React from 'react'

interface Props {
  importFile: File | null
  setImportFile: (f: File | null) => void
  importing: boolean
  importResult: string | null
  dragOver: boolean
  setDragOver: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  setImportResult: (v: string | null) => void
  onImport: () => void
}

export function GymRealmImportPanel({
  importFile, setImportFile, importing, importResult,
  dragOver, setDragOver, fileInputRef, setImportResult, onImport,
}: Props) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="text-xs text-white/50 uppercase tracking-widest mb-1">GymRealm — Дневен отчет</div>
      <p className="text-xs text-white/30 mb-4">
        Качи отчета — ще запише данните за <span className="text-amber-400 font-medium">всички дни</span> от файла. Не променя ръчно въведените данни.
      </p>

      <label
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors mb-3 ${
          dragOver ? 'border-amber-500 bg-amber-500/10'
          : importFile ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-white/15 hover:border-white/25'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false)
          const f = e.dataTransfer.files[0]; if (f) { setImportFile(f); setImportResult(null) }
        }}>
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

      <button onClick={onImport} disabled={importing || !importFile}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors">
        {importing ? '⏳ Обработвам...' : '📥 Импортирай'}
      </button>
    </div>
  )
}
```

**Step 4: Create `AlertsSection.tsx`**

```tsx
// app/(dashboard)/cash/components/AlertsSection.tsx
import { CashRecord } from '../types'
import { formatDateShort } from '@/lib/formatters'

interface Props {
  alertRecords: CashRecord[]
}

export function AlertsSection({ alertRecords }: Props) {
  if (alertRecords.length === 0) return null

  return (
    <div className="mb-6">
      <div className="text-xs text-red-400 uppercase tracking-widest mb-3">⚠️ Аномалии</div>
      <div className="space-y-2">
        {alertRecords.slice(0, 10).map(r => (
          <div key={r.id} className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-white font-medium">{formatDateShort(r.date)} — {r.staff_name}</div>
              {r.gym_cash_counted != null && r.admin_cash_counted != null && (
                <div className="text-xs text-red-400 mt-0.5">
                  Рецепция: {r.gym_cash_counted.toFixed(2)}€ / Admin: {r.admin_cash_counted.toFixed(2)}€
                  {' '}(разлика: {(r.admin_cash_counted - r.gym_cash_counted).toFixed(2)}€)
                </div>
              )}
              {r.notes && <div className="text-xs text-white/40 mt-0.5 italic">{r.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 5: Create `CashHistoryTable.tsx`**

```tsx
// app/(dashboard)/cash/components/CashHistoryTable.tsx
import { CashRecord } from '../types'
import { formatDateShort } from '@/lib/formatters'

interface Props {
  records: CashRecord[]
  adminDate: string
  today: string
  onRowClick: (date: string) => void
}

export function CashHistoryTable({ records, adminDate, today, onRowClick }: Props) {
  return (
    <>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-3">История</div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-1 px-4 py-2.5 bg-white/[0.03] text-xs text-white/40 uppercase tracking-wider">
          <div>Дата</div>
          <div>Служител</div>
          <div className="text-right">По система</div>
          <div className="text-right">Преброени</div>
          <div className="text-right">Admin</div>
          <div className="text-right">GymRealm</div>
        </div>
        {records.map(r => {
          const isSelected = r.date === adminDate
          const hasAlert = r.alert_physical_diff || r.alert_system_diff
          const isToday = r.date === today
          return (
            <div key={r.id}
              onClick={() => onRowClick(r.date)}
              className={`grid grid-cols-6 gap-1 px-4 py-2.5 border-t border-white/[0.06] text-sm items-center cursor-pointer transition-colors hover:bg-white/[0.03] ${
                isSelected ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500/40'
                : hasAlert ? 'bg-red-500/[0.04]'
                : isToday ? 'bg-amber-500/[0.02]'
                : ''
              }`}>
              <div className="text-white/70 flex items-center gap-1">
                {formatDateShort(r.date)}
                {hasAlert && <span className="text-red-400 text-xs">⚠</span>}
                {isToday && <span className="text-amber-400 text-xs">●</span>}
              </div>
              <div className="text-white/50 truncate text-xs">{r.staff_name || '—'}</div>
              <div className="text-right text-white/60">{r.gym_cash_system?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
              <div className="text-right font-medium text-white/80">{r.gym_cash_counted?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
              <div className={`text-right font-medium ${r.admin_cash_counted != null ? (r.alert_physical_diff ? 'text-red-400' : 'text-emerald-400') : 'text-white/20'}`}>
                {r.admin_cash_counted?.toFixed(2) ?? '—'}
              </div>
              <div className="text-right text-amber-400">{r.gymrealm_gym_cash?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
            </div>
          )
        })}
        {records.length === 0 && (
          <div className="text-center text-white/30 py-10 text-sm">Няма записи</div>
        )}
      </div>
    </>
  )
}
```

**Step 6: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 7: Commit all 5 admin components**

```bash
git add "app/(dashboard)/cash/components/"
git commit -m "refactor(cash): add 5 admin components"
```

---

### Task 5: Rewrite `page.tsx` as composition shell

**Files:**
- Modify: `app/(dashboard)/cash/page.tsx`

**Step 1: Replace the entire file**

```tsx
// app/(dashboard)/cash/page.tsx
'use client'

import { useCash } from './hooks/useCash'
import { CashHeader } from './components/CashHeader'
import { ReceptionistView } from './components/ReceptionistView'
import { AdminKpiCards } from './components/AdminKpiCards'
import { AdminCountPanel } from './components/AdminCountPanel'
import { GymRealmImportPanel } from './components/GymRealmImportPanel'
import { AlertsSection } from './components/AlertsSection'
import { CashHistoryTable } from './components/CashHistoryTable'
import { MONTHS_BG } from '@/lib/formatters'
import { formatDate } from '@/lib/formatters'

export default function CashPage() {
  const c = useCash()

  if (c.userRole !== 'admin') {
    return (
      <ReceptionistView
        today={c.today}
        saved={c.saved}
        setSaved={c.setSaved}
        saving={c.saving}
        error={c.error}
        setError={c.setError}
        gymSystem={c.gymSystem}
        setGymSystem={c.setGymSystem}
        gymCounted={c.gymCounted}
        setGymCounted={c.setGymCounted}
        notes={c.notes}
        setNotes={c.setNotes}
        hasYesterdayAlert={c.hasYesterdayAlert}
        yesterdayStr={c.yesterdayStr}
        yesterdayRec={c.yesterdayRec}
        loading={c.loading}
        onSave={c.handleStaffSave}
        onAckAlert={c.handleAckAlert}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <CashHeader title="Дневна каса — Фитнес" subtitle={formatDate(c.today)} />

      <div className="p-6 max-w-5xl mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={c.goToPrevMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
            ‹
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-white">{MONTHS_BG[c.viewMonth]} {c.viewYear}</div>
            {!c.isCurrentMonth && (
              <button onClick={() => {
                const now = new Date()
                c.resetToMonth(now.getFullYear(), now.getMonth())
              }} className="text-xs text-amber-400/70 hover:text-amber-400 mt-0.5">→ Текущ месец</button>
            )}
          </div>
          <button onClick={c.goToNextMonth} disabled={c.isCurrentMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
            ›
          </button>
        </div>

        {c.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {c.error && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <span>⚠️ {c.error}</span>
                <button onClick={() => c.setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            <AdminKpiCards
              alertCount={c.alertRecords.length}
              recordsWithDataCount={c.recordsWithData.length}
              gymrealmImportCount={c.records.filter(r => r.gymrealm_gym_cash != null).length}
              viewMonth={c.viewMonth}
            />

            <div className="grid grid-cols-2 gap-6 mb-6">
              <AdminCountPanel
                adminDate={c.adminDate}
                adminCounted={c.adminCounted}
                setAdminCounted={c.setAdminCounted}
                adminSaving={c.adminSaving}
                adminSaved={c.adminSaved}
                adminRec={c.adminRec}
                grDiff={c.grDiff}
                monthStart={c.monthStart}
                monthEnd={c.monthEnd}
                today={c.today}
                isCurrentMonth={c.isCurrentMonth}
                onDateChange={c.handleAdminDateChange}
                onSave={c.handleAdminSave}
              />
              <GymRealmImportPanel
                importFile={c.importFile}
                setImportFile={c.setImportFile}
                importing={c.importing}
                importResult={c.importResult}
                dragOver={c.dragOver}
                setDragOver={c.setDragOver}
                fileInputRef={c.fileInputRef}
                setImportResult={c.setImportResult}
                onImport={c.handleImport}
              />
            </div>

            <AlertsSection alertRecords={c.alertRecords} />

            <CashHistoryTable
              records={c.records}
              adminDate={c.adminDate}
              today={c.today}
              onRowClick={c.handleAdminDateChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
```

**Note:** `importResult` setter needs to be exposed from the hook. In `useCash.ts`, ensure `setImportResult` is included in the return object (it is already declared as `useState`, just add it to the return statement alongside `importResult`).

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/cash/page.tsx"
git commit -m "refactor(cash): rewrite page as composition shell"
```

---

## Final Result

```
app/(dashboard)/cash/
├── page.tsx                        ~100 lines  (was 626)
├── types.ts                        ~20 lines
├── hooks/
│   └── useCash.ts                  ~175 lines
└── components/
    ├── CashHeader.tsx              ~20 lines
    ├── ReceptionistView.tsx        ~80 lines
    ├── AdminKpiCards.tsx           ~25 lines
    ├── AdminCountPanel.tsx         ~75 lines
    ├── GymRealmImportPanel.tsx     ~55 lines
    ├── AlertsSection.tsx           ~30 lines
    └── CashHistoryTable.tsx        ~55 lines
```

Total: ~635 lines across 10 files. Zero behavior change.
