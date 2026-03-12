# Дневен отчет — Tab Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge "Дневна каса — Фитнес" and "Дневна каса — Зала" into a single "Дневен отчет" menu item for receptionists, with a tabbed page showing both forms.

**Architecture:** Navigation change restricts `/cash` and `/hall-cash` to admin-only; receptionist gets a new `/daily-report` route with a local-state tab switcher rendering `ReceptionistView` (Fitness) and a new self-contained `ReceptionistHallView` (Hall). No API changes needed.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, React hooks

---

## Chunk 1: Navigation + ReceptionistView embedded prop

### Task 1: Update navigation — restrict cash/hall-cash to admin, add daily-report for receptionist

**Files:**
- Modify: `src/modules/common/navigation.ts:12-13`

- [ ] **Step 1: Edit navigation.ts**

Change lines 12–13 from `roles: ['admin', 'receptionist']` to `roles: ['admin']` for both `cash` and `hall-cash`. Add a new `daily-report` item immediately after `hall-cash`:

```typescript
  { key: 'cash', label: 'Дневна каса — Фитнес', icon: '💶', href: '/cash', roles: ['admin'] },
  { key: 'hall-cash', label: 'Дневна каса — Зала', icon: '🎽', href: '/hall-cash', roles: ['admin'] },
  { key: 'daily-report', label: 'Дневен отчет', icon: '🗒️', href: '/daily-report', roles: ['receptionist'] },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/common/navigation.ts
git commit -m "feat(nav): daily-report for receptionist, cash/hall-cash admin-only"
```

---

### Task 2: Add `embedded` prop to ReceptionistView

**Files:**
- Modify: `app/(dashboard)/cash/components/ReceptionistView.tsx`

The component currently has `<div className="min-h-screen">` as root and renders `<CashHeader>` unconditionally. When `embedded={true}`, both must be suppressed so the component is layout-neutral inside a tab container.

- [ ] **Step 1: Edit ReceptionistView.tsx**

Add `embedded?: boolean` to the `Props` interface and apply it:

```typescript
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
  embedded?: boolean
}

export function ReceptionistView({
  today, saved, setSaved, saving, error, setError,
  gymSystem, setGymSystem, gymCounted, setGymCounted,
  notes, setNotes, hasYesterdayAlert, yesterdayStr, yesterdayRec,
  loading, onSave, onAckAlert, embedded = false,
}: Props) {
  return (
    <div className={embedded ? undefined : 'min-h-screen'}>
      {!embedded && <CashHeader title="Дневна каса — Фитнес" subtitle={formatDate(today)} saved={saved} />}
      {/* rest of JSX unchanged */}
```

Keep everything from `<div className="p-6 max-w-sm mx-auto">` onwards exactly as-is.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Verify existing /cash page unaffected**

Start dev server and log in as admin. Navigate to `/cash`. Confirm it renders exactly as before (header visible, full layout).

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/cash/components/ReceptionistView.tsx
git commit -m "feat(cash): add embedded prop to ReceptionistView"
```

---

## Chunk 2: ReceptionistHallView + hall-cash page update

### Task 3: Create ReceptionistHallView — self-contained hall cash form

**Files:**
- Create: `app/(dashboard)/hall-cash/components/ReceptionistHallView.tsx`

This component owns all its state and data fetching. It calls `GET /api/hall-cash?role=receptionist` — the API automatically returns today + yesterday for non-admin (no date param needed). It uses `useSession()` to get `userName` for the save POST body.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p ~/vitality-gym/app/\(dashboard\)/hall-cash/components
```

- [ ] **Step 2: Write ReceptionistHallView.tsx**

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/hall-cash/components/ReceptionistHallView.tsx
git commit -m "feat(hall-cash): extract ReceptionistHallView as self-contained component"
```

---

### Task 4: Update hall-cash/page.tsx to use ReceptionistHallView

**Files:**
- Modify: `app/(dashboard)/hall-cash/page.tsx:1-300`

Replace the entire inline receptionist block (lines 212–300, the `if (userRole !== 'admin') { return (...) }` section) with a single import + render.

- [ ] **Step 1: Add import at top of hall-cash/page.tsx**

After the existing imports (around line 14), add:

```typescript
import { ReceptionistHallView } from './components/ReceptionistHallView'
```

- [ ] **Step 2: Replace the receptionist block**

Find the block starting at line 212:
```typescript
  // ══════════════ RECEPTIONIST VIEW ══════════════
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen">
        ...
      </div>
    )
  }
```

Replace the entire `if (userRole !== 'admin') { return (...) }` block (lines 212–300) with:

```typescript
  // ══════════════ RECEPTIONIST VIEW ══════════════
  if (userRole !== 'admin') {
    return <ReceptionistHallView />
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/hall-cash/page.tsx
git commit -m "refactor(hall-cash): use ReceptionistHallView component"
```

---

## Chunk 3: New /daily-report page

### Task 5: Create the /daily-report page with tabs

**Files:**
- Create: `app/(dashboard)/daily-report/page.tsx`

This page:
- Uses `useCash()` for the Fitness tab (provides all props for `ReceptionistView`)
- Renders `ReceptionistHallView` for the Hall tab (self-contained, no props needed)
- Provides its own sticky header with page title + "✓ Записано" badge
- Has a tab bar: "ОТЧЕТ - ФИТНЕС" | "ОТЧЕТ - ЗАЛА"

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ~/vitality-gym/app/\(dashboard\)/daily-report
```

- [ ] **Step 2: Write daily-report/page.tsx**

```typescript
// app/(dashboard)/daily-report/page.tsx
'use client'

import { useState } from 'react'
import { useCash } from '@/app/(dashboard)/cash/hooks/useCash'
import { ReceptionistView } from '@/app/(dashboard)/cash/components/ReceptionistView'
import { ReceptionistHallView } from '@/app/(dashboard)/hall-cash/components/ReceptionistHallView'
import { formatDate } from '@/lib/formatters'

type Tab = 'fitness' | 'hall'

export default function DailyReportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('fitness')

  const {
    today, loading, error, setError,
    saved, setSaved, saving,
    gymSystem, setGymSystem,
    gymCounted, setGymCounted,
    notes, setNotes,
    hasYesterdayAlert, yesterdayStr, yesterdayRec,
    handleStaffSave, handleAckAlert,
  } = useCash()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Дневен отчет</h1>
            <p className="text-sm text-white/60 mt-0.5">{formatDate(today)}</p>
          </div>
          {/* Badge shows when fitness form is saved, regardless of active tab */}
          {saved && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ Записано
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab('fitness')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'fitness'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
            }`}>
            ОТЧЕТ — ФИТНЕС
          </button>
          <button
            onClick={() => setActiveTab('hall')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'hall'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
            }`}>
            ОТЧЕТ — ЗАЛА
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'fitness' ? (
        <ReceptionistView
          embedded
          today={today}
          saved={saved}
          setSaved={setSaved}
          saving={saving}
          error={error}
          setError={setError}
          gymSystem={gymSystem}
          setGymSystem={setGymSystem}
          gymCounted={gymCounted}
          setGymCounted={setGymCounted}
          notes={notes}
          setNotes={setNotes}
          hasYesterdayAlert={hasYesterdayAlert}
          yesterdayStr={yesterdayStr}
          yesterdayRec={yesterdayRec}
          loading={loading}
          onSave={handleStaffSave}
          onAckAlert={handleAckAlert}
        />
      ) : (
        <ReceptionistHallView />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Smoke test in browser**

Start dev server (`npm run dev`), log in as receptionist. Verify:
- Sidebar shows "🗒️ Дневен отчет" (not the two old cash items)
- Navigating to `/daily-report` renders the page with header + tab bar
- "ОТЧЕТ — ФИТНЕС" tab shows the fitness cash form
- "ОТЧЕТ — ЗАЛА" tab shows the hall cash form
- Saving works on both tabs
- Log in as admin — sidebar still shows "Дневна каса — Фитнес" and "Дневна каса — Зала" separately; `/cash` and `/hall-cash` work normally

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/daily-report/page.tsx
git commit -m "feat(daily-report): combined receptionist tab page (fitness + hall)"
```
