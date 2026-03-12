# Hall Page Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/(dashboard)/hall/page.tsx` (588 lines) into a ~70-line composition shell + 6 tab components + types file, matching the requests-page-split pattern.

**Architecture:** Extract shared types to `types.ts`, extract each tab's JSX to a focused component in `components/`, keep all 3 existing hooks untouched. Page becomes a thin composition shell that wires hooks → components. Zero behavior changes.

**Tech Stack:** Next.js 14, React, TypeScript strict, Tailwind CSS

---

## Reference: Current File Map

`app/(dashboard)/hall/page.tsx` (588 lines):
- Lines 1–13: imports + helper functions (`pctChange`, `PctBadge`)
- Lines 26–127: state, derived data, tabs definition
- Lines 128–161: JSX Header + Tabs nav
- Lines 162–177: Error banners
- Lines 180–301: Attendance tab JSX
- Lines 304–342: Yearly tab JSX
- Lines 345–379: Reconciliation tab JSX
- Lines 382–485: Clients tab JSX
- Lines 488–538: Import tab JSX
- Lines 541–585: Config tab JSX

Hooks already extracted:
- `hooks/useHallData.ts` (187 lines) — data fetching
- `hooks/useAttendance.ts` (143 lines) — edit mutations
- `hooks/useImport.ts` (82 lines) — file import

---

## Target Structure

```
app/(dashboard)/hall/
├── page.tsx                         ~70 lines  (composition shell)
├── types.ts                         ~60 lines  (shared interfaces)
├── hooks/
│   ├── useHallData.ts              187 lines  (unchanged)
│   ├── useAttendance.ts            143 lines  (unchanged)
│   └── useImport.ts                 82 lines  (unchanged)
└── components/
    ├── HallHeader.tsx               ~35 lines
    ├── AttendanceTab.tsx           ~130 lines
    ├── YearlyTab.tsx                ~50 lines
    ├── ReconciliationTab.tsx        ~45 lines
    ├── ClientsTab.tsx              ~115 lines
    ├── ImportTab.tsx                ~60 lines
    └── ConfigTab.tsx                ~50 lines
```

---

### Task 1: Create `types.ts`

**Files:**
- Create: `app/(dashboard)/hall/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/(dashboard)/hall/types.ts

export interface HallClass {
  id: string
  name: string
  price_cash: number
  price_subscription: number
  price_multisport: number
  price_coolfit: number
  instructor_percent: number
  max_capacity: number
  duration_minutes: number
}

export interface HallAttendance {
  id: string
  class_id: string
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  visits_unknown: number
  total_visits: number
  total_revenue: number
  instructor_percent: number
  adjustments: number
  final_payment: number
  hall_classes?: { name: string }
}

export interface Reconciliation {
  class_name: string
  operator: string
  visits_gymrealm: number
  visits_operator: number
  difference: number
}

export interface YearlyRow {
  month: string
  total_visits: number
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  total_revenue: number
  total_payments: number
  gym_profit: number
  is_locked: boolean
}

export interface ClientVisit {
  client_name: string
  class_name: string
  total_visits: number
  months_active: number
  first_seen?: string
  last_seen?: string
}

export interface NoShowClient {
  client_name: string
  class_name: string
  client_phone?: string
  total_noshows: number
  noshow_percent: number
  last_noshow?: string
}

export interface LapsedClient {
  client_name: string
  last_seen?: string
  classes: string
  total_visits: number
}

export type TabKey = 'attendance' | 'yearly' | 'reconciliation' | 'clients' | 'import' | 'config'

export const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']

export function monthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function pctChange(current: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((current - prev) / prev) * 100)
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -10`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/hall/types.ts"
git commit -m "refactor(hall): extract types and helpers"
```

---

### Task 2: Create `components/HallHeader.tsx`

**Files:**
- Create: `app/(dashboard)/hall/components/HallHeader.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/(dashboard)/hall/components/HallHeader.tsx
import { monthLabel, TabKey } from '../types'

const TABS = [
  { key: 'attendance' as TabKey, label: '📊 Месечни данни' },
  { key: 'yearly' as TabKey, label: '📅 Година' },
  { key: 'reconciliation' as TabKey, label: '🔄 Reconciliation' },
  { key: 'clients' as TabKey, label: '👥 Клиенти' },
  { key: 'import' as TabKey, label: '📥 Import' },
  { key: 'config' as TabKey, label: '⚙️ Настройки' },
]

interface Props {
  selectedMonth: string
  isLocked: boolean
  activeTab: TabKey
  onPrevMonth: () => void
  onNextMonth: () => void
  onToggleLock: () => void
  onTabChange: (tab: TabKey) => void
}

export function HallHeader({ selectedMonth, isLocked, activeTab, onPrevMonth, onNextMonth, onToggleLock, onTabChange }: Props) {
  return (
    <>
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Vitality Hall</h1>
            <p className="text-sm text-white/60 mt-0.5">Групови тренировки · {monthLabel(selectedMonth)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">🔒 Заключен</span>}
            <button onClick={onPrevMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">‹</button>
            <span className="text-sm font-semibold w-36 text-center text-white">{monthLabel(selectedMonth)}</span>
            <button onClick={onNextMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">›</button>
            <button onClick={onToggleLock} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isLocked ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25' : 'bg-white/[0.05] text-white/60 border-white/10 hover:bg-white/10'
            }`}>
              {isLocked ? '🔓 Отключи' : '🔒 Заключи'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex border-b border-white/[0.06] px-6 overflow-x-auto bg-[#060609]">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'border-violet-400 text-violet-400' : 'border-transparent text-white/40 hover:text-white/70'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -10`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/hall/components/HallHeader.tsx"
git commit -m "refactor(hall): extract HallHeader component"
```

---

### Task 3: Create `components/AttendanceTab.tsx`

**Files:**
- Create: `app/(dashboard)/hall/components/AttendanceTab.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/(dashboard)/hall/components/AttendanceTab.tsx
import { HallAttendance, TabKey, pctChange } from '../types'

function PctBadge({ current, prev }: { current: number; prev: number }) {
  const pct = pctChange(current, prev)
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ml-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

interface Totals {
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  visits_unknown: number
  total_visits: number
  total_revenue: number
  final_payment: number
}

interface PrevTotals {
  total_visits: number
  total_revenue: number
  final_payment: number
}

interface EditValues {
  visits_cash?: number
  visits_subscription?: number
  visits_multisport?: number
  visits_coolfit?: number
  instructor_percent?: number
  adjustments?: number
  total_revenue?: number
}

interface Props {
  attendance: HallAttendance[]
  totals: Totals
  prevTotals: PrevTotals
  gymProfit: number
  prevGymProfit: number
  prevByClassId: Record<string, HallAttendance>
  isLocked: boolean
  loading: boolean
  recalculating: boolean
  applyingRecon: boolean
  restoringOriginal: boolean
  hasReconciliation: boolean
  editingId: string | null
  editValues: EditValues
  setEditValues: React.Dispatch<React.SetStateAction<EditValues>>
  onRecalculate: () => void
  onApplyReconciliation: () => void
  onRestoreOriginal: () => void
  onEditStart: (id: string) => void
  onEditCancel: () => void
  onSaveEdit: (id: string) => void
  onGoToImport: () => void
}

export function AttendanceTab({
  attendance, totals, prevTotals, gymProfit, prevGymProfit,
  prevByClassId, isLocked, loading, recalculating, applyingRecon,
  restoringOriginal, hasReconciliation, editingId, editValues, setEditValues,
  onRecalculate, onApplyReconciliation, onRestoreOriginal,
  onEditStart, onEditCancel, onSaveEdit, onGoToImport,
}: Props) {
  const COL = '1.5fr 0.7fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 0.7fr 0.5fr 0.6fr 0.7fr 60px'

  return (
    <>
      <div className="grid grid-cols-5 gap-4 mb-4">
        {[
          { label: 'Посещения', value: totals.total_visits, prev: prevTotals.total_visits, display: totals.total_visits.toString() },
          { label: 'Оборот', value: totals.total_revenue, prev: prevTotals.total_revenue, display: `${totals.total_revenue.toFixed(0)}€`, color: 'text-violet-400' },
          { label: 'Хонорари', value: totals.final_payment, prev: prevTotals.final_payment, display: `${totals.final_payment.toFixed(0)}€`, color: 'text-orange-400' },
          { label: 'Печалба', value: gymProfit, prev: prevGymProfit, display: `${gymProfit.toFixed(0)}€`, color: 'text-emerald-400' },
          { label: 'Марж', value: 0, prev: 0, display: `${totals.total_revenue > 0 ? ((gymProfit / totals.total_revenue) * 100).toFixed(1) : 0}%`, color: 'text-sky-400', noChange: true },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.display}</div>
            {!c.noChange && prevTotals.total_visits > 0 && (
              <div className="mt-1">
                <PctBadge current={c.value} prev={c.prev} />
                <span className="text-xs text-white/30 ml-1">vs пред. месец</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLocked && attendance.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={onRecalculate} disabled={recalculating} className="bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-violet-300 px-4 py-2 rounded-lg text-sm transition-colors">
            {recalculating ? '⏳ Преизчислявам...' : '🔄 Преизчисли оборота'}
          </button>
          {hasReconciliation && (
            <>
              <button
                onClick={() => { if (window.confirm('Това ще презапише броя Мултиспорт и Куулфит посещения с данните от операторите. Продължи?')) onApplyReconciliation() }}
                disabled={applyingRecon}
                className="bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 disabled:opacity-40 text-sky-300 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {applyingRecon ? '⏳ Прилагам...' : '✅ Приложи Reconciliation'}
              </button>
              <button
                onClick={() => { if (window.confirm('Това ще върне Мултиспорт и Куулфит посещения към оригиналните данни от GymRealm. Продължи?')) onRestoreOriginal() }}
                disabled={restoringOriginal}
                className="bg-white/[0.05] border border-white/10 hover:bg-white/10 disabled:opacity-40 text-white/60 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {restoringOriginal ? '⏳ Възстановявам...' : '↩ Оригинални данни'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : attendance.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-white/40 mb-4">Няма данни</div>
          <button onClick={onGoToImport} className="bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 px-6 py-3 rounded-xl text-sm transition-colors">📥 Импортирай</button>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide" style={{ gridTemplateColumns: COL }}>
            <div>Клас</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Куулфит</div><div>Празно</div><div>Общо</div><div>Оборот</div><div>%</div><div>Удръжки</div><div>Платено</div><div></div>
          </div>
          {attendance.map(row => {
            const isEditing = editingId === row.id
            const v = isEditing ? { ...row, ...editValues } : row
            const prev = prevByClassId[row.class_id]
            return (
              <div key={row.id} className={`grid gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] transition-colors ${isEditing ? 'bg-white/[0.04]' : ''}`} style={{ gridTemplateColumns: COL }}>
                <div>
                  <div className="text-sm font-medium text-white">{row.hall_classes?.name}</div>
                  <div className="text-xs text-white/40">{row.instructor_percent}%</div>
                </div>
                {isEditing ? (
                  <>
                    {(['visits_cash', 'visits_subscription', 'visits_multisport', 'visits_coolfit'] as const).map(f => (
                      <input key={f} type="number" value={v[f]} onChange={e => setEditValues(p => ({ ...p, [f]: parseInt(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    ))}
                    <div className="text-sm text-white/40">{v.visits_unknown || 0}</div>
                    <div className="text-sm text-white">{v.visits_cash + v.visits_subscription + v.visits_multisport + v.visits_coolfit}</div>
                    <div className="text-sm text-violet-400">{v.total_revenue.toFixed(0)}€</div>
                    <input type="number" value={v.instructor_percent} onChange={e => setEditValues(p => ({ ...p, instructor_percent: parseFloat(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    <input type="number" value={v.adjustments} onChange={e => setEditValues(p => ({ ...p, adjustments: parseFloat(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    <div className="text-sm font-bold text-orange-400">{(v.total_revenue * (v.instructor_percent / 100) + (v.adjustments || 0)).toFixed(0)}€</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-white/80">{row.visits_cash}{prev && <PctBadge current={row.visits_cash} prev={prev.visits_cash} />}</div>
                    <div className="text-sm text-white/80">{row.visits_subscription}{prev && <PctBadge current={row.visits_subscription} prev={prev.visits_subscription} />}</div>
                    <div className="text-sm text-white/80">{row.visits_multisport}{prev && <PctBadge current={row.visits_multisport} prev={prev.visits_multisport} />}</div>
                    <div className="text-sm text-white/80">{row.visits_coolfit}{prev && <PctBadge current={row.visits_coolfit} prev={prev.visits_coolfit} />}</div>
                    <div className="text-sm text-white/40">{row.visits_unknown || 0}</div>
                    <div className="text-sm font-medium text-white">{row.total_visits}{prev && <PctBadge current={row.total_visits} prev={prev.total_visits} />}</div>
                    <div className="text-sm text-violet-400 font-medium">{row.total_revenue.toFixed(0)}€</div>
                    <div className="text-sm text-white/60">{row.instructor_percent}%</div>
                    <div className={`text-sm ${row.adjustments !== 0 ? (row.adjustments > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/20'}`}>{row.adjustments !== 0 ? `${row.adjustments > 0 ? '+' : ''}${row.adjustments}` : '—'}</div>
                    <div className="text-sm font-bold text-orange-400">{row.final_payment.toFixed(0)}€</div>
                  </>
                )}
                <div className="flex gap-1">
                  {!isLocked && (isEditing
                    ? <><button onClick={() => onSaveEdit(row.id)} className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded">✓</button><button onClick={onEditCancel} className="text-xs bg-white/[0.05] border border-white/10 text-white/50 px-2 py-1 rounded">✗</button></>
                    : <button onClick={() => onEditStart(row.id)} className="text-xs bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/50 px-2 py-1 rounded transition-colors">✎</button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="grid gap-2 px-4 py-3 border-t-2 border-white/10 bg-white/[0.02] font-semibold text-sm" style={{ gridTemplateColumns: COL }}>
            <div className="text-white">ОБЩО</div>
            <div className="text-white/80">{totals.visits_cash}</div><div className="text-white/80">{totals.visits_subscription}</div><div className="text-white/80">{totals.visits_multisport}</div><div className="text-white/80">{totals.visits_coolfit}</div>
            <div className="text-white/40">{totals.visits_unknown}</div>
            <div className="font-bold text-white">{totals.total_visits}</div>
            <div className="text-violet-400 font-bold">{totals.total_revenue.toFixed(0)}€</div>
            <div></div><div></div>
            <div className="text-orange-400 font-bold">{totals.final_payment.toFixed(0)}€</div>
            <div></div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/hall/components/AttendanceTab.tsx"
git commit -m "refactor(hall): extract AttendanceTab component"
```

---

### Task 4: Create remaining 4 tab components

**Files:**
- Create: `app/(dashboard)/hall/components/YearlyTab.tsx`
- Create: `app/(dashboard)/hall/components/ReconciliationTab.tsx`
- Create: `app/(dashboard)/hall/components/ClientsTab.tsx`
- Create: `app/(dashboard)/hall/components/ImportTab.tsx`
- Create: `app/(dashboard)/hall/components/ConfigTab.tsx`

- [ ] **Step 1: Create `YearlyTab.tsx`**

```tsx
// app/(dashboard)/hall/components/YearlyTab.tsx
import { YearlyRow, monthLabel } from '../types'

interface Props {
  yearlyData: YearlyRow[]
  onSelectMonth: (month: string) => void
}

export function YearlyTab({ yearlyData, onSelectMonth }: Props) {
  if (yearlyData.length === 0) {
    return <div className="text-center text-gray-500 py-20">Няма данни</div>
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Годишен преглед</h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Общо посещения', value: yearlyData.reduce((a, r) => a + r.total_visits, 0) },
          { label: 'Общ оборот', value: `${yearlyData.reduce((a, r) => a + r.total_revenue, 0).toFixed(0)}€`, color: 'text-violet-400' },
          { label: 'Общо хонорари', value: `${yearlyData.reduce((a, r) => a + r.total_payments, 0).toFixed(0)}€`, color: 'text-orange-400' },
          { label: 'Обща печалба', value: `${yearlyData.reduce((a, r) => a + r.gym_profit, 0).toFixed(0)}€`, color: 'text-emerald-400' },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide">
          <div>Месец</div><div>Посещения</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Оборот</div><div>Печалба</div><div>Статус</div>
        </div>
        {yearlyData.map((row, i) => (
          <div key={i} className="grid grid-cols-8 gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] cursor-pointer transition-colors"
            onClick={() => onSelectMonth(row.month)}>
            <div className="text-sm font-medium text-white">{monthLabel(row.month + '-01')}</div>
            <div className="text-sm text-white/80">{row.total_visits}</div>
            <div className="text-sm text-white/50">{row.visits_cash}</div>
            <div className="text-sm text-white/50">{row.visits_subscription}</div>
            <div className="text-sm text-white/50">{row.visits_multisport}</div>
            <div className="text-sm text-violet-400 font-medium">{row.total_revenue.toFixed(0)}€</div>
            <div className="text-sm text-emerald-400 font-medium">{row.gym_profit.toFixed(0)}€</div>
            <div>{row.is_locked ? <span className="text-xs text-yellow-400">🔒 Заключен</span> : <span className="text-xs text-blue-400">● Отворен</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `ReconciliationTab.tsx`**

```tsx
// app/(dashboard)/hall/components/ReconciliationTab.tsx
import { Reconciliation, monthLabel } from '../types'

interface Props {
  reconByClass: Record<string, { multisport?: Reconciliation; coolfit?: Reconciliation }>
  selectedMonth: string
}

export function ReconciliationTab({ reconByClass, selectedMonth }: Props) {
  const COL = '1.5fr 0.8fr 0.8fr 0.6fr 0.8fr 0.8fr 0.6fr'

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Reconciliation — {monthLabel(selectedMonth)}</h2>
      {Object.keys(reconByClass).length === 0 ? (
        <div className="text-center text-white/40 py-20">
          Няма reconciliation данни.<br />
          <span className="text-sm">Качи Мултиспорт и Куулфит файлове при импорта.</span>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide" style={{ gridTemplateColumns: COL }}>
            <div>Клас</div>
            <div className="text-center">GymRealm (MS)</div><div className="text-center">Мултиспорт</div><div className="text-center">Разлика</div>
            <div className="text-center">GymRealm (CF)</div><div className="text-center">Куулфит</div><div className="text-center">Разлика</div>
          </div>
          {Object.entries(reconByClass).map(([cls, ops]) => {
            const ms = ops.multisport
            const cf = ops.coolfit
            return (
              <div key={cls} className="grid gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02]" style={{ gridTemplateColumns: COL }}>
                <div className="text-sm font-medium">{cls}</div>
                <div className="text-sm text-center">{ms ? ms.visits_gymrealm : '—'}</div>
                <div className="text-sm text-center">{ms ? ms.visits_operator : '—'}</div>
                <div className={`text-sm text-center font-bold ${!ms ? 'text-gray-600' : ms.difference === 0 ? 'text-green-400' : ms.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {ms ? (ms.difference > 0 ? `+${ms.difference}` : ms.difference === 0 ? '✓' : ms.difference) : '—'}
                </div>
                <div className="text-sm text-center">{cf ? cf.visits_gymrealm : '—'}</div>
                <div className="text-sm text-center">{cf ? cf.visits_operator : '—'}</div>
                <div className={`text-sm text-center font-bold ${!cf ? 'text-gray-600' : cf.difference === 0 ? 'text-green-400' : cf.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {cf ? (cf.difference > 0 ? `+${cf.difference}` : cf.difference === 0 ? '✓' : cf.difference) : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `ClientsTab.tsx`**

```tsx
// app/(dashboard)/hall/components/ClientsTab.tsx
import { ClientVisit, NoShowClient, LapsedClient, monthLabel } from '../types'

interface Props {
  availableMonths: string[]
  periodFrom: string
  periodTo: string
  setPeriodFrom: (v: string) => void
  setPeriodTo: (v: string) => void
  filteredClients: ClientVisit[]
  filteredNoshows: NoShowClient[]
  newClients: ClientVisit[]
  lapsedClients: LapsedClient[]
  uniqueActiveClients: string[]
}

export function ClientsTab({
  availableMonths, periodFrom, periodTo, setPeriodFrom, setPeriodTo,
  filteredClients, filteredNoshows, newClients, lapsedClients, uniqueActiveClients,
}: Props) {
  return (
    <div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-3">Период за анализ</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">От:</span>
            <select value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none">
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">До:</span>
            <select value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none">
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            {[3, 6, 12].map(months => {
              const to = availableMonths[availableMonths.length - 1] || ''
              const fromDate = new Date(to + '-01')
              fromDate.setMonth(fromDate.getMonth() - months + 1)
              const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`
              return (
                <button key={months} onClick={() => { setPeriodFrom(from); setPeriodTo(to) }}
                  className="px-3 py-1.5 bg-white/[0.05] border border-white/10 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors">
                  Последни {months}м
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Активни клиенти', value: uniqueActiveClients.length, color: 'text-emerald-400', sub: 'посещавали в периода' },
          { label: 'Нови клиенти', value: newClients.length, color: 'text-sky-400', sub: 'първо посещение в периода' },
          { label: 'Отпаднали', value: lapsedClients.length, color: 'text-orange-400', sub: 'не са идвали 30+ дни' },
          { label: 'No-shows', value: filteredNoshows.reduce((a, c) => a + c.total_noshows, 0), color: 'text-red-400', sub: 'резервации без присъствие' },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-white/30 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">🏆 Топ 15 — Най-редовни</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {filteredClients.slice(0, 15).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/30 w-5 font-mono">{i + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{c.client_name}</div>
                    <div className="text-xs text-white/40">{c.class_name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-violet-400">{c.total_visits} посещения</div>
                  <div className="text-xs text-white/40">{c.months_active} месеца</div>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма данни за периода</div>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">⚠️ Топ No-shows</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {filteredNoshows.slice(0, 15).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/30 w-5 font-mono">{i + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{c.client_name}</div>
                    <div className="text-xs text-white/40">{c.class_name}</div>
                    {c.client_phone && <div className="text-xs text-sky-400 mt-0.5">📞 {c.client_phone}</div>}
                    <div className="text-xs text-white/30">Последен: {c.last_noshow ? monthLabel(c.last_noshow) : '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-400">{c.total_noshows} no-show</div>
                  <div className="text-xs text-white/40">{c.noshow_percent}% от резервации</div>
                </div>
              </div>
            ))}
            {filteredNoshows.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма no-shows за периода</div>}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">📉 Отпаднали клиенти — не са идвали 30+ дни</h3>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide">
            <div>Клиент</div><div>Последно посещение</div><div>Класове</div><div>Общо посещения</div>
          </div>
          {lapsedClients.map((c, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] transition-colors">
              <div className="text-sm font-medium text-white">{c.client_name}</div>
              <div className="text-sm text-orange-400">{c.last_seen ? monthLabel(c.last_seen) : '—'}</div>
              <div className="text-xs text-white/40">{c.classes}</div>
              <div className="text-sm text-white/70">{c.total_visits}</div>
            </div>
          ))}
          {lapsedClients.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма отпаднали клиенти</div>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `ImportTab.tsx`**

```tsx
// app/(dashboard)/hall/components/ImportTab.tsx
import { monthLabel } from '../types'

interface Props {
  selectedMonth: string
  isLocked: boolean
  importing: boolean
  importResult: string | null
  gymrealmFile: File | null
  multisportFile: File | null
  coolfitFile: File | null
  dragOver: string | null
  setGymrealmFile: (f: File | null) => void
  setMultisportFile: (f: File | null) => void
  setCoolfitFile: (f: File | null) => void
  setDragOver: (key: string | null) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onImport: () => void
  onDrop: (e: React.DragEvent, setFile: (f: File | null) => void) => void
}

export function ImportTab({
  selectedMonth, isLocked, importing, importResult,
  gymrealmFile, multisportFile, coolfitFile, dragOver,
  setGymrealmFile, setMultisportFile, setCoolfitFile, setDragOver,
  onPrevMonth, onNextMonth, onImport, onDrop,
}: Props) {
  const fileSlots = [
    { key: 'gymrealm', label: 'GymRealm Export', required: true, accept: '.xlsx,.xls', file: gymrealmFile, setFile: setGymrealmFile },
    { key: 'multisport', label: 'Мултиспорт Service Report', required: false, accept: '.xlsx,.xls,.csv', file: multisportFile, setFile: setMultisportFile },
    { key: 'coolfit', label: 'Куулфит Report (PDF)', required: false, accept: '.pdf,.xlsx', file: coolfitFile, setFile: setCoolfitFile },
  ]

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">Import</h2>
      <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-4 mb-6">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Месец за импорт</div>
        <div className="flex items-center gap-3">
          <button onClick={onPrevMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">‹</button>
          <span className="text-lg font-bold text-violet-400 w-40 text-center">{monthLabel(selectedMonth)}</span>
          <button onClick={onNextMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">›</button>
        </div>
      </div>
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-amber-400 text-sm">
          🔒 Месецът е заключен. Отключи го за да импортираш.
        </div>
      )}
      <div className="space-y-4">
        {fileSlots.map(item => (
          <div key={item.key} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-white/40">{item.required ? 'Задължителен' : 'По избор — за reconciliation'}</div>
              </div>
              {item.file && <span className="text-xs text-emerald-400">✓ {item.file.name}</span>}
            </div>
            <label
              className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                dragOver === item.key ? 'border-violet-500 bg-violet-500/10' : item.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/15 hover:border-white/30'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(item.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(e, item.setFile)}
            >
              <input type="file" accept={item.accept} className="hidden" onChange={e => item.setFile(e.target.files?.[0] || null)} />
              <span className="text-sm text-white/40">{item.file ? '🔄 Смени файл' : '📁 Избери или провлачи файл тук'}</span>
            </label>
          </div>
        ))}
      </div>
      {importResult && (
        <div className={`mt-4 p-4 rounded-xl text-sm whitespace-pre-line ${
          importResult.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>{importResult}</div>
      )}
      <button onClick={onImport} disabled={importing || !gymrealmFile || isLocked}
        className="mt-6 w-full bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-violet-300 py-3 rounded-xl font-medium transition-colors">
        {importing ? 'Импортирам...' : `📥 Импортирай за ${monthLabel(selectedMonth)}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create `ConfigTab.tsx`**

```tsx
// app/(dashboard)/hall/components/ConfigTab.tsx
import { HallClass } from '../types'

interface Props {
  classes: HallClass[]
}

export function ConfigTab({ classes }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Настройки на класовете</h2>
      <div className="space-y-3">
        {classes.map(cls => (
          <div key={cls.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-white">{cls.name}</div>
              <div className="text-xs text-white/40">{cls.duration_minutes} мин • Макс. {cls.max_capacity} души</div>
            </div>
            <div className="grid grid-cols-6 gap-3 text-xs">
              {[
                { label: 'В брой (€)', field: 'price_cash', value: cls.price_cash },
                { label: 'Абонамент (€)', field: 'price_subscription', value: cls.price_subscription },
                { label: 'Мултиспорт (€)', field: 'price_multisport', value: cls.price_multisport },
                { label: 'Куулфит (€)', field: 'price_coolfit', value: cls.price_coolfit },
                { label: '% Инструктор', field: 'instructor_percent', value: cls.instructor_percent },
                { label: 'Капацитет', field: 'max_capacity', value: cls.max_capacity },
              ].map(f => (
                <div key={f.field}>
                  <div className="text-white/50 mb-1">{f.label}</div>
                  <input
                    type="number"
                    defaultValue={f.value}
                    onBlur={async e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) {
                        await fetch('/api/hall/classes', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: cls.id, field: f.field, value: val }),
                        })
                      }
                    }}
                    className="bg-white/5 border border-white/15 rounded px-2 py-1.5 text-white w-full focus:border-violet-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {classes.length === 0 && <div className="text-center text-white/30 py-10">Първо импортирай GymRealm файл.</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors

- [ ] **Step 7: Commit all 5 components**

```bash
git add "app/(dashboard)/hall/components/"
git commit -m "refactor(hall): extract 5 tab components"
```

---

### Task 5: Rewrite `page.tsx` as composition shell

**Files:**
- Modify: `app/(dashboard)/hall/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
// app/(dashboard)/hall/page.tsx
'use client'

import { useState } from 'react'
import { useHallData } from './hooks/useHallData'
import { useAttendance } from './hooks/useAttendance'
import { useImport } from './hooks/useImport'
import { TabKey } from './types'
import { HallHeader } from './components/HallHeader'
import { AttendanceTab } from './components/AttendanceTab'
import { YearlyTab } from './components/YearlyTab'
import { ReconciliationTab } from './components/ReconciliationTab'
import { ClientsTab } from './components/ClientsTab'
import { ImportTab } from './components/ImportTab'
import { ConfigTab } from './components/ConfigTab'

export default function HallPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('attendance')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  const prevMonth = () => {
    const d = new Date(selectedMonth)
    d.setMonth(d.getMonth() - 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  const nextMonth = () => {
    const d = new Date(selectedMonth)
    d.setMonth(d.getMonth() + 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const {
    attendance, prevAttendance, classes, reconciliation,
    yearlyData, allClients, noshows, lapsedClients,
    availableMonths, isLocked, loading, error: dataError,
    loadData, toggleLock,
  } = useHallData(selectedMonth)

  const {
    editingId, setEditingId, editValues, setEditValues,
    recalculating, applyingRecon, restoringOriginal,
    saveError, setSaveError,
    saveEdit, handleRecalculate, handleApplyReconciliation, handleRestoreOriginal,
  } = useAttendance(attendance, reconciliation, selectedMonth, loadData)

  const {
    importing, importResult,
    gymrealmFile, setGymrealmFile,
    multisportFile, setMultisportFile,
    coolfitFile, setCoolfitFile,
    dragOver, setDragOver,
    handleImport, handleDrop,
  } = useImport(selectedMonth, (m) => {
    const d = new Date(m)
    return `${['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'][d.getMonth()]} ${d.getFullYear()}`
  }, loadData, setActiveTab)

  // Derived: attendance totals
  const totals = attendance.reduce((acc, r) => ({
    visits_cash: acc.visits_cash + r.visits_cash,
    visits_subscription: acc.visits_subscription + r.visits_subscription,
    visits_multisport: acc.visits_multisport + r.visits_multisport,
    visits_coolfit: acc.visits_coolfit + r.visits_coolfit,
    visits_unknown: acc.visits_unknown + (r.visits_unknown || 0),
    total_visits: acc.total_visits + (r.total_visits || 0),
    total_revenue: acc.total_revenue + r.total_revenue,
    final_payment: acc.final_payment + r.final_payment,
  }), { visits_cash: 0, visits_subscription: 0, visits_multisport: 0, visits_coolfit: 0, visits_unknown: 0, total_visits: 0, total_revenue: 0, final_payment: 0 })

  const prevTotals = prevAttendance.reduce((acc, r) => ({
    total_visits: acc.total_visits + (r.total_visits || 0),
    total_revenue: acc.total_revenue + r.total_revenue,
    final_payment: acc.final_payment + r.final_payment,
  }), { total_visits: 0, total_revenue: 0, final_payment: 0 })

  const gymProfit = totals.total_revenue - totals.final_payment
  const prevGymProfit = prevTotals.total_revenue - prevTotals.final_payment

  const prevByClassId: Record<string, typeof prevAttendance[0]> = {}
  for (const r of prevAttendance) prevByClassId[r.class_id] = r

  const reconByClass: Record<string, { multisport?: typeof reconciliation[0]; coolfit?: typeof reconciliation[0] }> = {}
  for (const r of reconciliation) {
    if (!reconByClass[r.class_name]) reconByClass[r.class_name] = {}
    reconByClass[r.class_name][r.operator as 'multisport' | 'coolfit'] = r
  }

  const filteredClients = allClients.filter(c => {
    if (!periodFrom || !periodTo) return true
    const ls = c.last_seen?.substring(0, 7) || ''
    return ls >= periodFrom && ls <= periodTo
  })
  const filteredNoshows = noshows.filter(c => {
    if (!periodFrom || !periodTo) return true
    const ln = c.last_noshow?.substring(0, 7) || ''
    return ln >= periodFrom && ln <= periodTo
  })
  const newClients = allClients.filter(c => {
    const fs = c.first_seen?.substring(0, 7) || ''
    return fs >= periodFrom && fs <= periodTo
  })
  const uniqueActiveClients = [...new Set(filteredClients.map(c => c.client_name))]

  return (
    <div className="min-h-screen">
      <HallHeader
        selectedMonth={selectedMonth}
        isLocked={isLocked}
        activeTab={activeTab}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onToggleLock={toggleLock}
        onTabChange={setActiveTab}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {dataError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <span>⚠️ {dataError}</span>
            <button onClick={loadData} className="ml-auto text-xs underline hover:no-underline">Опитай пак</button>
          </div>
        )}
        {saveError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <span>⚠️ {saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab
            attendance={attendance}
            totals={totals}
            prevTotals={prevTotals}
            gymProfit={gymProfit}
            prevGymProfit={prevGymProfit}
            prevByClassId={prevByClassId}
            isLocked={isLocked}
            loading={loading}
            recalculating={recalculating}
            applyingRecon={applyingRecon}
            restoringOriginal={restoringOriginal}
            hasReconciliation={reconciliation.length > 0}
            editingId={editingId}
            editValues={editValues}
            setEditValues={setEditValues}
            onRecalculate={handleRecalculate}
            onApplyReconciliation={handleApplyReconciliation}
            onRestoreOriginal={handleRestoreOriginal}
            onEditStart={(id) => { setEditingId(id); setEditValues({}) }}
            onEditCancel={() => { setEditingId(null); setEditValues({}) }}
            onSaveEdit={saveEdit}
            onGoToImport={() => setActiveTab('import')}
          />
        )}
        {activeTab === 'yearly' && (
          <YearlyTab
            yearlyData={yearlyData}
            onSelectMonth={(month) => { setSelectedMonth(month); setActiveTab('attendance') }}
          />
        )}
        {activeTab === 'reconciliation' && (
          <ReconciliationTab reconByClass={reconByClass} selectedMonth={selectedMonth} />
        )}
        {activeTab === 'clients' && (
          <ClientsTab
            availableMonths={availableMonths}
            periodFrom={periodFrom}
            periodTo={periodTo}
            setPeriodFrom={setPeriodFrom}
            setPeriodTo={setPeriodTo}
            filteredClients={filteredClients}
            filteredNoshows={filteredNoshows}
            newClients={newClients}
            lapsedClients={lapsedClients}
            uniqueActiveClients={uniqueActiveClients}
          />
        )}
        {activeTab === 'import' && (
          <ImportTab
            selectedMonth={selectedMonth}
            isLocked={isLocked}
            importing={importing}
            importResult={importResult}
            gymrealmFile={gymrealmFile}
            multisportFile={multisportFile}
            coolfitFile={coolfitFile}
            dragOver={dragOver}
            setGymrealmFile={setGymrealmFile}
            setMultisportFile={setMultisportFile}
            setCoolfitFile={setCoolfitFile}
            setDragOver={setDragOver}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onImport={handleImport}
            onDrop={handleDrop}
          />
        )}
        {activeTab === 'config' && <ConfigTab classes={classes} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Verify dev server starts**

Run: `. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npm run dev &` — open http://localhost:3000/hall and verify all 6 tabs render correctly.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/hall/page.tsx"
git commit -m "refactor(hall): rewrite page as ~70-line composition shell"
```

---

## Final Result

```
app/(dashboard)/hall/
├── page.tsx               ~70 lines  (was 588)
├── types.ts               ~60 lines
├── hooks/
│   ├── useHallData.ts    187 lines  (unchanged)
│   ├── useAttendance.ts  143 lines  (unchanged)
│   └── useImport.ts       82 lines  (unchanged)
└── components/
    ├── HallHeader.tsx     ~60 lines
    ├── AttendanceTab.tsx ~130 lines
    ├── YearlyTab.tsx      ~55 lines
    ├── ReconciliationTab.tsx ~50 lines
    ├── ClientsTab.tsx    ~110 lines
    ├── ImportTab.tsx      ~65 lines
    └── ConfigTab.tsx      ~50 lines
```

Total: ~880 lines across 10 files. Zero behavior change.
