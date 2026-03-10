# Shifts Page Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `app/(dashboard)/shifts/page.tsx` (810 lines) into focused files matching the pattern used in `/pt` and `/deliveries`.

**Architecture:** Extract shared types/utils to `utils.ts`, all state+handlers to `hooks/useShifts.ts`, each UI section to a component in `components/`. Page becomes a ~40-line composition shell. Zero behavior changes.

**Tech Stack:** Next.js 14, React, TypeScript strict, Tailwind CSS

---

## Reference: Current File Map

Before touching anything, understand what's in `app/(dashboard)/shifts/page.tsx`:
- Lines 1–28: types (Staff, Shift, Holiday, GymSettings), constants (LEAVE_TYPES, STAFF_ROLES)
- Lines 30–96: pure utility functions (addMinutes, calcHours, getShiftTimes, getShiftDisplay, getDaysInMonth)
- Lines 98–379: ShiftsPage component — state, loadData, handlers, derived state
- Lines 381–546: JSX — header, summary cards, calendar grid
- Lines 548–804: JSX — 5 modals (edit shift, delete month, add staff, edit staff, settings)
- Lines 784–809: missing shifts section

---

### Task 1: Create `utils.ts`

**Files:**
- Create: `app/(dashboard)/shifts/utils.ts`

**Step 1: Create the file with all exported types, constants, and pure functions**

```typescript
// app/(dashboard)/shifts/utils.ts

export interface Staff {
  id: string
  name: string
  role: string
  hourly_rate: number
  phone: string | null
  active: boolean
  sort_order: number
}

export interface Shift {
  id: string
  staff_id: string
  date: string
  start_time: string
  end_time: string
  shift_type: string
  notes: string | null
}

export interface Holiday { date: string; name: string }

export interface GymSettings {
  weekday_open: string
  weekday_close: string
  weekday_shift_duration_minutes: number
  saturday_open: string
  saturday_close: string
  saturday_shifts: number
  sunday_open: string
  sunday_close: string
  sunday_shifts: number
}

export const LEAVE_TYPES = [
  { label: 'Болничен', type: 'sick', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  { label: 'Платен отпуск', type: 'paid_leave', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { label: 'Неплатен отпуск', type: 'unpaid_leave', color: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
]

export const STAFF_ROLES = [
  { value: 'Reception', label: 'Рецепция' },
  { value: 'instructor', label: 'Инструктор' },
  { value: 'cleaning', label: 'Почистване' },
  { value: 'admin', label: 'Администратор' },
]

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}

export function getShiftTimes(
  settings: GymSettings,
  dayOfWeek: number,
  type: 'first' | 'second' | 'full'
): { start: string; end: string } {
  let open: string, close: string, duration: number, shifts: number
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    open = settings.weekday_open.slice(0, 5)
    close = settings.weekday_close.slice(0, 5)
    duration = settings.weekday_shift_duration_minutes
    shifts = 2
  } else if (dayOfWeek === 6) {
    open = settings.saturday_open.slice(0, 5)
    close = settings.saturday_close.slice(0, 5)
    duration = Math.round(calcHours(settings.saturday_open.slice(0, 5), settings.saturday_close.slice(0, 5)) * 60 / (settings.saturday_shifts || 1))
    shifts = settings.saturday_shifts
  } else {
    open = settings.sunday_open.slice(0, 5)
    close = settings.sunday_close.slice(0, 5)
    duration = Math.round(calcHours(settings.sunday_open.slice(0, 5), settings.sunday_close.slice(0, 5)) * 60 / (settings.sunday_shifts || 1))
    shifts = settings.sunday_shifts
  }
  if (type === 'full' || shifts === 1) return { start: open, end: close }
  if (type === 'first') return { start: open, end: addMinutes(open, duration) }
  return { start: addMinutes(open, duration), end: close }
}

export function getShiftDisplay(shift: Shift): { text: string; sub?: string; color: string } {
  const leave = LEAVE_TYPES.find(l => l.type === shift.shift_type)
  if (leave) return { text: leave.label, color: leave.color }
  const hours = calcHours(shift.start_time, shift.end_time)
  const label = shift.shift_type === 'first' ? 'I' : shift.shift_type === 'second' ? 'II' : ''
  return {
    text: `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`,
    sub: `${hours.toFixed(0)}ч${label ? ' ' + label : ''}`,
    color: shift.shift_type === 'first'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
      : shift.shift_type === 'second'
        ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) days.push(new Date(year, month, d))
  return days
}
```

**Step 2: Verify — no errors**

Run: `cd ~/vitality-gym && npx tsc --noEmit`
Expected: no errors from utils.ts

**Step 3: Commit**

```bash
git add app/(dashboard)/shifts/utils.ts
git commit -m "refactor(shifts): extract types, constants, utils"
```

---

### Task 2: Create `hooks/useShifts.ts`

**Files:**
- Create: `app/(dashboard)/shifts/hooks/useShifts.ts`

This hook owns ALL state and handlers. Components become pure presentational.

**Step 1: Create the file**

```typescript
// app/(dashboard)/shifts/hooks/useShifts.ts
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { MONTHS_BG } from '@/lib/formatters'
import { useSession } from '@/hooks/useSession'
import {
  Staff, Shift, Holiday, GymSettings,
  LEAVE_TYPES, calcHours, getDaysInMonth, getShiftTimes,
} from '../utils'

export interface StaffSummary extends Staff {
  totalShifts: number
  totalHours: number
  weekendShifts: number
  sickDays: number
  paidLeave: number
}

export interface MissingDay {
  date: string
  day: Date
  missing: Staff[]
}

export function useShifts() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [staff, setStaff] = useState<Staff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [settings, setSettings] = useState<GymSettings | null>(null)
  const { userRole } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit shift modal
  const [editCell, setEditCell] = useState<{ staffId: string; date: string } | null>(null)
  const [editMode, setEditMode] = useState<'shift' | 'leave'>('shift')
  const [editPreset, setEditPreset] = useState<string>('none')
  const [editStart, setEditStart] = useState('06:30')
  const [editEnd, setEditEnd] = useState('14:45')
  const [editLeaveType, setEditLeaveType] = useState('sick')
  const [wholeWeek, setWholeWeek] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  // Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [editStaff, setEditStaff] = useState<Staff | null>(null)
  const [savingStaff, setSavingStaff] = useState(false)

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState<GymSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Copy / delete month
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<string | null>(null)
  const [showDeleteMonth, setShowDeleteMonth] = useState(false)
  const [deletingMonth, setDeletingMonth] = useState(false)

  // Reorder
  const [reorderMode, setReorderMode] = useState(false)
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [year, month] = currentMonth.split('-').map(Number)
  const days = useMemo(() => getDaysInMonth(year, month - 1), [year, month])
  const monthLabel = `${MONTHS_BG[month - 1]} ${year}`
  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [shiftRes, settRes, holRes] = await Promise.all([
      fetch(`/api/shifts?month=${currentMonth}`),
      fetch('/api/shifts?type=settings'),
      fetch(`/api/shifts?type=holidays&month=${currentMonth}`),
    ])
    const [shiftData, settData, holData] = await Promise.all([
      shiftRes.json(), settRes.json(), holRes.json(),
    ])
    setStaff(shiftData.staff || [])
    setShifts(shiftData.shifts || [])
    setSettings(settData.settings || null)
    setHolidays(holData.holidays || [])
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])

  const getShift = useCallback((staffId: string, date: string) =>
    shifts.find(s => s.staff_id === staffId && s.date === date), [shifts])

  const getHoliday = useCallback((date: string) =>
    holidays.find(h => h.date === date), [holidays])

  const missingByDate = useMemo((): MissingDay[] =>
    days
      .filter(day => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        if (dateStr > today) return false
        const dow = day.getDay()
        if (dow === 0 || dow === 6) return false
        return staff.some(s => !getShift(s.id, dateStr))
      })
      .map(day => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        return { date: dateStr, day, missing: staff.filter(s => !getShift(s.id, dateStr)) }
      })
      .filter(d => d.missing.length > 0),
  [days, year, month, today, staff, getShift])

  const staffSummary = useMemo((): StaffSummary[] => staff.map(s => {
    const ss = shifts.filter(sh => sh.staff_id === s.id)
    const workShifts = ss.filter(sh => !LEAVE_TYPES.some(l => l.type === sh.shift_type))
    const totalHours = workShifts.reduce((a, sh) => a + calcHours(sh.start_time, sh.end_time), 0)
    const weekendShifts = workShifts.filter(sh => {
      const d = new Date(sh.date).getDay()
      return d === 0 || d === 6
    }).length
    const sickDays = ss.filter(sh => sh.shift_type === 'sick').length
    const paidLeave = ss.filter(sh => sh.shift_type === 'paid_leave').length
    return { ...s, totalShifts: workShifts.length, totalHours, weekendShifts, sickDays, paidLeave }
  }), [staff, shifts])

  const handleCellClick = useCallback((staffId: string, date: string) => {
    if (userRole !== 'admin') return
    setWholeWeek(false)
    const existing = getShift(staffId, date)
    const d = new Date(date + 'T12:00:00')
    if (existing) {
      const isLeave = LEAVE_TYPES.some(l => l.type === existing.shift_type)
      if (isLeave) { setEditMode('leave'); setEditLeaveType(existing.shift_type) }
      else {
        setEditMode('shift'); setEditPreset(existing.shift_type)
        setEditStart(existing.start_time.slice(0, 5)); setEditEnd(existing.end_time.slice(0, 5))
      }
    } else if (settings) {
      setEditMode('shift'); setEditPreset('none')
      const times = getShiftTimes(settings, d.getDay(), 'first')
      setEditStart(times.start); setEditEnd(times.end)
    }
    setEditCell({ staffId, date })
  }, [userRole, getShift, settings])

  const handlePresetSelect = useCallback((type: string) => {
    if (!settings || !editCell) return
    if (editPreset === type) { setEditPreset('none'); return }
    setEditPreset(type)
    if (type === 'first' || type === 'second' || type === 'full') {
      const d = new Date(editCell.date + 'T12:00:00')
      const times = getShiftTimes(settings, d.getDay(), type as 'first' | 'second' | 'full')
      setEditStart(times.start); setEditEnd(times.end)
    }
  }, [settings, editCell, editPreset])

  const handleBulkAssign = useCallback(async (
    staffId: string, date: string, shiftType: string, start: string, end: string
  ) => {
    if (!settings) return
    setBulkSaving(true)
    const d = new Date(date + 'T12:00:00')
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dow - 1))
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_weekdays', staff_id: staffId, month: currentMonth,
        shift_type: shiftType, start_time: start, end_time: end,
        week_monday: monday.toISOString().split('T')[0],
      }),
    })
    setBulkSaving(false)
  }, [settings, currentMonth])

  const handleSaveShift = useCallback(async () => {
    if (!editCell) return
    setSaving(true)
    let start = editStart, end = editEnd, shiftType = editPreset
    if (editMode === 'leave') { start = '00:00'; end = '00:00'; shiftType = editLeaveType }
    if (wholeWeek && editMode === 'shift') {
      await handleBulkAssign(editCell.staffId, editCell.date, shiftType, start, end)
    } else {
      await fetch('/api/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: editCell.staffId, date: editCell.date,
          start_time: start, end_time: end, shift_type: shiftType,
        }),
      })
    }
    await loadData(); setSaving(false); setEditCell(null); setWholeWeek(false)
  }, [editCell, editStart, editEnd, editPreset, editMode, editLeaveType, wholeWeek, handleBulkAssign, loadData])

  const handleDeleteShift = useCallback(async () => {
    if (!editCell) return
    setSaving(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', staff_id: editCell.staffId, date: editCell.date }),
    })
    await loadData(); setSaving(false); setEditCell(null)
  }, [editCell, loadData])

  const handleDeleteMonth = useCallback(async () => {
    setDeletingMonth(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_month', month: currentMonth }),
    })
    setShowDeleteMonth(false); setDeletingMonth(false); await loadData()
  }, [currentMonth, loadData])

  const handleAddStaff = useCallback(async (name: string, role: string, phone: string) => {
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_staff', name, role, phone: phone || null }),
    })
    setShowAddStaff(false); await loadData()
  }, [loadData])

  const handleSaveStaff = useCallback(async (name: string, role: string, phone: string) => {
    if (!editStaff) return
    setSavingStaff(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_staff', staff_id: editStaff.id, name, role, phone: phone || null }),
    })
    setEditStaff(null); await loadData(); setSavingStaff(false)
  }, [editStaff, loadData])

  const handleToggleStaffActive = useCallback(async (s: Staff) => {
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_staff', staff_id: s.id, active: !s.active }),
    })
    setEditStaff(null); await loadData()
  }, [loadData])

  const handleCopyMonth = useCallback(async () => {
    setCopying(true); setCopyResult(null)
    const res = await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy_month', target_month: currentMonth }),
    })
    const data = await res.json()
    setCopyResult(data.count > 0
      ? `✓ Копирани ${data.count} смени`
      : data.message || 'Няма смени за копиране')
    await loadData(); setCopying(false)
    setTimeout(() => setCopyResult(null), 4000)
  }, [currentMonth, loadData])

  const handleSaveSettings = useCallback(async () => {
    if (!settingsForm) return
    setSavingSettings(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', ...settingsForm }),
    })
    setShowSettings(false); await loadData(); setSavingSettings(false)
  }, [settingsForm, loadData])

  const handleReorderDrop = useCallback((targetId: string) => {
    if (!draggedStaffId || draggedStaffId === targetId) return
    const newOrder = [...staff]
    const fromIdx = newOrder.findIndex(s => s.id === draggedStaffId)
    const toIdx = newOrder.findIndex(s => s.id === targetId)
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    setStaff(newOrder.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })))
    setDraggedStaffId(null)
  }, [draggedStaffId, staff])

  const handleSaveOrder = useCallback(async () => {
    setSavingOrder(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_staff', order: staff.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 })) }),
    })
    setSavingOrder(false); setReorderMode(false)
  }, [staff])

  const prevMonth = useCallback(() => {
    const d = new Date(year, month - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }, [year, month])

  const nextMonth = useCallback(() => {
    const d = new Date(year, month, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }, [year, month])

  return {
    // data
    staff, shifts, holidays, settings, loading, saving,
    year, month, days, monthLabel, today, userRole,
    staffSummary, missingByDate,
    // edit shift modal
    editCell, setEditCell,
    editMode, setEditMode,
    editPreset,
    editStart, setEditStart,
    editEnd, setEditEnd,
    editLeaveType, setEditLeaveType,
    wholeWeek, setWholeWeek,
    bulkSaving,
    // staff modal
    showAddStaff, setShowAddStaff,
    editStaff, setEditStaff,
    savingStaff,
    // settings modal
    showSettings, setShowSettings,
    settingsForm, setSettingsForm,
    savingSettings,
    // copy / delete
    copying, copyResult,
    showDeleteMonth, setShowDeleteMonth,
    deletingMonth,
    // reorder
    reorderMode, setReorderMode,
    draggedStaffId, setDraggedStaffId,
    savingOrder,
    // handlers
    getShift, getHoliday,
    handleCellClick, handlePresetSelect,
    handleSaveShift, handleDeleteShift, handleDeleteMonth,
    handleAddStaff, handleSaveStaff, handleToggleStaffActive,
    handleCopyMonth, handleSaveSettings,
    handleReorderDrop, handleSaveOrder,
    prevMonth, nextMonth,
  }
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add app/(dashboard)/shifts/hooks/useShifts.ts
git commit -m "refactor(shifts): extract useShifts hook"
```

---

### Task 3: Create `components/ShiftsHeader.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/ShiftsHeader.tsx`

```tsx
// app/(dashboard)/shifts/components/ShiftsHeader.tsx
import { Holiday } from '../utils'

interface Props {
  monthLabel: string
  holidays: Holiday[]
  userRole: string
  copying: boolean
  copyResult: string | null
  reorderMode: boolean
  savingOrder: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onCopyMonth: () => void
  onDeleteMonth: () => void
  onToggleReorder: () => void
  onSaveOrder: () => void
  onAddStaff: () => void
  onOpenSettings: () => void
}

export function ShiftsHeader({
  monthLabel, holidays, userRole,
  copying, copyResult, reorderMode, savingOrder,
  onPrevMonth, onNextMonth, onCopyMonth, onDeleteMonth,
  onToggleReorder, onSaveOrder, onAddStaff, onOpenSettings,
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Смени</h1>
          <p className="text-sm text-white/50 mt-0.5">Работен график</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {userRole === 'admin' && (<>
            <button onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white">⚙️</button>
            <button onClick={onCopyMonth} disabled={copying}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white disabled:opacity-30">
              {copying ? '...' : copyResult
                ? <span className="text-emerald-400">{copyResult}</span>
                : '📋 Копирай предходен'}
            </button>
            <button onClick={onDeleteMonth}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400/70 border border-red-500/20 hover:text-red-400">
              🗑 Изтрий месеца
            </button>
            <button onClick={onToggleReorder}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border ${
                reorderMode
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                  : 'bg-white/5 text-white/50 border-white/[0.08] hover:text-white'
              }`}>
              {reorderMode ? '✓ Готово' : '↕ Пренареди'}
            </button>
            {reorderMode && (
              <button onClick={onSaveOrder} disabled={savingOrder}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 disabled:opacity-40">
                {savingOrder ? '...' : '💾 Запази реда'}
              </button>
            )}
            <button onClick={onAddStaff}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white">
              + Служител
            </button>
          </>)}
          <button onClick={onPrevMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">‹</button>
          <span className="text-sm font-semibold w-40 text-center text-white">{monthLabel}</span>
          <button onClick={onNextMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">›</button>
        </div>
      </div>

      {holidays.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {holidays.map(h => (
            <div key={h.date} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1">
              <span className="text-[9px] text-red-400/70 font-mono">
                {new Date(h.date + 'T12:00:00').toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-[10px] text-red-400 font-medium">{h.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add app/(dashboard)/shifts/components/ShiftsHeader.tsx
git commit -m "refactor(shifts): extract ShiftsHeader component"
```

---

### Task 4: Create `components/StaffSummaryCards.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/StaffSummaryCards.tsx`

```tsx
// app/(dashboard)/shifts/components/StaffSummaryCards.tsx
import { Staff, STAFF_ROLES } from '../utils'
import { StaffSummary } from '../hooks/useShifts'

interface Props {
  staffSummary: StaffSummary[]
  reorderMode: boolean
  draggedStaffId: string | null
  userRole: string
  onEdit: (s: Staff) => void
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
}

function roleGradient(role: string) {
  if (role === 'admin') return 'from-amber-400 to-orange-500'
  if (role === 'instructor') return 'from-emerald-400 to-green-500'
  if (role === 'cleaning') return 'from-purple-400 to-violet-500'
  return 'from-sky-400 to-blue-500'
}

export function StaffSummaryCards({
  staffSummary, reorderMode, draggedStaffId, userRole, onEdit, onDragStart, onDrop,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      {staffSummary.map(s => (
        <div key={s.id}
          onClick={() => !reorderMode && userRole === 'admin' && onEdit(s)}
          draggable={reorderMode}
          onDragStart={() => onDragStart(s.id)}
          onDragOver={e => { if (reorderMode) e.preventDefault() }}
          onDrop={() => reorderMode && onDrop(s.id)}
          className={`bg-white/[0.02] border rounded-xl p-3 transition-all ${
            reorderMode
              ? 'border-amber-400/20 cursor-grab active:cursor-grabbing select-none'
              : 'border-white/[0.06] cursor-pointer hover:border-white/[0.12]'
          } ${draggedStaffId === s.id ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${roleGradient(s.role)} flex items-center justify-center text-[10px] font-bold text-[#0a0a0f]`}>
              {s.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{s.name}</div>
              <div className="text-[9px] text-white/40">{STAFF_ROLES.find(r => r.value === s.role)?.label || s.role}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-white/50">Смени</div><div className="text-right text-white font-medium">{s.totalShifts}</div>
            <div className="text-white/50">Часове</div><div className="text-right text-white font-medium">{s.totalHours.toFixed(1)}ч</div>
            {s.weekendShifts > 0 && <><div className="text-white/50">Уикенд</div><div className="text-right text-white/80">{s.weekendShifts}</div></>}
            {s.sickDays > 0 && <><div className="text-red-400/70">Болничен</div><div className="text-right text-red-400">{s.sickDays}д</div></>}
            {s.paidLeave > 0 && <><div className="text-blue-400/70">Отпуск</div><div className="text-right text-blue-400">{s.paidLeave}д</div></>}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/StaffSummaryCards.tsx
git commit -m "refactor(shifts): extract StaffSummaryCards component"
```

---

### Task 5: Create `components/ShiftsCalendarGrid.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/ShiftsCalendarGrid.tsx`

```tsx
// app/(dashboard)/shifts/components/ShiftsCalendarGrid.tsx
import { DAYS_BG_SHORT as DAYS_BG } from '@/lib/formatters'
import { Staff, Shift, Holiday, getShiftDisplay } from '../utils'

interface Props {
  staff: Staff[]
  days: Date[]
  year: number
  month: number
  today: string
  userRole: string
  editCell: { staffId: string; date: string } | null
  getShift: (staffId: string, date: string) => Shift | undefined
  getHoliday: (date: string) => Holiday | undefined
  onCellClick: (staffId: string, date: string) => void
}

function roleGradient(role: string) {
  if (role === 'admin') return 'from-amber-400 to-orange-500'
  if (role === 'instructor') return 'from-emerald-400 to-green-500'
  if (role === 'cleaning') return 'from-purple-400 to-violet-500'
  return 'from-sky-400 to-blue-500'
}

function toDateStr(year: number, month: number, day: Date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

export function ShiftsCalendarGrid({
  staff, days, year, month, today, userRole, editCell, getShift, getHoliday, onCellClick,
}: Props) {
  const cols = `140px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid gap-px bg-white/[0.04]" style={{ gridTemplateColumns: cols }}>
          <div className="bg-[#060609] px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider">Служител</div>
          {days.map(day => {
            const dateStr = toDateStr(year, month, day)
            const isToday = dateStr === today
            const isWeekend = day.getDay() === 0 || day.getDay() === 6
            const holiday = getHoliday(dateStr)
            const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
            return (
              <div key={dateStr}
                className={`bg-[#060609] px-0.5 py-1.5 text-center ${isToday ? 'bg-amber-500/5' : ''} ${holiday ? 'bg-red-500/10' : ''}`}
                title={holiday?.name || ''}>
                <div className={`text-[8px] uppercase tracking-wider ${isWeekend || holiday ? 'text-red-400/60' : 'text-white/30'}`}>{DAYS_BG[dowIdx]}</div>
                <div className={`text-[11px] font-semibold mt-0.5 ${isToday ? 'text-amber-400' : isWeekend || holiday ? 'text-red-400/80' : 'text-white/70'}`}>{day.getDate()}</div>
                {holiday && <div className="mt-0.5 flex justify-center"><div className="w-1 h-1 rounded-full bg-red-400/70" /></div>}
              </div>
            )
          })}
        </div>

        {/* Staff rows */}
        {staff.map(s => (
          <div key={s.id} className="grid gap-px" style={{ gridTemplateColumns: cols }}>
            <div className="bg-[#0a0a0f] px-3 py-2 flex items-center gap-2 border-t border-white/[0.04]">
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleGradient(s.role)} flex items-center justify-center text-[9px] font-bold text-[#0a0a0f] shrink-0`}>
                {s.name.charAt(0)}
              </div>
              <span className="text-xs font-medium text-white/80 truncate">{s.name}</span>
            </div>
            {days.map(day => {
              const dateStr = toDateStr(year, month, day)
              const shift = getShift(s.id, dateStr)
              const isToday = dateStr === today
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const holiday = getHoliday(dateStr)
              const display = shift ? getShiftDisplay(shift) : null
              const isEditing = editCell?.staffId === s.id && editCell?.date === dateStr
              return (
                <div key={dateStr} onClick={() => onCellClick(s.id, dateStr)}
                  className={`relative border-t border-white/[0.04] min-h-[44px] flex items-center justify-center px-0.5 transition-all
                    ${isToday ? 'bg-amber-500/[0.03]' : holiday ? 'bg-red-500/[0.05]' : isWeekend ? 'bg-white/[0.01]' : 'bg-[#0a0a0f]'}
                    ${userRole === 'admin' ? 'cursor-pointer hover:bg-white/[0.04]' : ''}
                    ${isEditing ? 'ring-1 ring-amber-400/50' : ''}`}>
                  {holiday && <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500/30" />}
                  {display && (
                    <div className={`text-center px-0.5 py-0.5 rounded border ${display.color} w-full`}>
                      <div className="text-[8px] font-medium leading-tight">{display.text}</div>
                      {display.sub && <div className="text-[7px] opacity-60">{display.sub}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/ShiftsCalendarGrid.tsx
git commit -m "refactor(shifts): extract ShiftsCalendarGrid component"
```

---

### Task 6: Create `components/ShiftEditModal.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/ShiftEditModal.tsx`

```tsx
// app/(dashboard)/shifts/components/ShiftEditModal.tsx
import { Staff, Shift, Holiday, GymSettings, LEAVE_TYPES, getShiftTimes, calcHours } from '../utils'

interface Props {
  editCell: { staffId: string; date: string }
  settings: GymSettings
  staff: Staff[]
  editMode: 'shift' | 'leave'
  editPreset: string
  editStart: string
  editEnd: string
  editLeaveType: string
  wholeWeek: boolean
  saving: boolean
  bulkSaving: boolean
  setEditMode: (m: 'shift' | 'leave') => void
  setEditStart: (v: string) => void
  setEditEnd: (v: string) => void
  setEditLeaveType: (v: string) => void
  setWholeWeek: (v: boolean | ((prev: boolean) => boolean)) => void
  onPresetSelect: (type: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  getShift: (staffId: string, date: string) => Shift | undefined
  getHoliday: (date: string) => Holiday | undefined
}

export function ShiftEditModal({
  editCell, settings, staff,
  editMode, editPreset, editStart, editEnd, editLeaveType, wholeWeek,
  saving, bulkSaving,
  setEditMode, setEditStart, setEditEnd, setEditLeaveType, setWholeWeek,
  onPresetSelect, onSave, onDelete, onClose,
  getShift, getHoliday,
}: Props) {
  const staffMember = staff.find(s => s.id === editCell.staffId)
  const holiday = getHoliday(editCell.date)
  const hasExisting = !!getShift(editCell.staffId, editCell.date)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-1">{staffMember?.name}</div>
        <div className="text-xs text-white/40 mb-4">
          {new Date(editCell.date + 'T12:00:00').toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
          {holiday && (
            <span className="ml-2 inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 text-red-400">
              🎄 {holiday.name}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-4 bg-white/[0.03] rounded-lg p-1">
          <button onClick={() => setEditMode('shift')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${editMode === 'shift' ? 'bg-amber-400/10 text-amber-400' : 'text-white/40'}`}>Смяна</button>
          <button onClick={() => setEditMode('leave')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${editMode === 'leave' ? 'bg-amber-400/10 text-amber-400' : 'text-white/40'}`}>Отсъствие</button>
        </div>

        {editMode === 'shift' ? (<>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['first', 'second', 'full'] as const).map(type => {
              const times = getShiftTimes(settings, new Date(editCell.date + 'T12:00:00').getDay(), type)
              const label = type === 'first' ? 'Първа' : type === 'second' ? 'Втора' : 'Цял ден'
              return (
                <button key={type} onClick={() => onPresetSelect(type)}
                  className={`py-2 rounded-xl text-xs font-medium border ${editPreset === type ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06] text-white/60'}`}>
                  <div>{label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{times.start}-{times.end}</div>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">От</label>
              <input type="time" value={editStart} onChange={e => { setEditStart(e.target.value); onPresetSelect('custom') }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">До</label>
              <input type="time" value={editEnd} onChange={e => { setEditEnd(e.target.value); onPresetSelect('custom') }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          </div>
          <div className="text-xs text-white/50 text-center mb-3">{calcHours(editStart, editEnd).toFixed(1)} часа</div>
          {editPreset === 'none' && (
            <p className="text-[10px] text-white/30 text-center -mt-2 mb-3">Избери смяна или въведи часове</p>
          )}
          <button onClick={() => setWholeWeek(w => !w)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-4 transition-all ${
              wholeWeek ? 'bg-amber-400/10 border-amber-400/25 text-amber-400' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
            }`}>
            <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${wholeWeek ? 'bg-amber-400 border-amber-400' : 'border-white/20 bg-white/5'}`}>
              {wholeWeek && <span className="text-[9px] text-black font-bold">✓</span>}
            </div>
            <span className="text-xs font-medium">Цяла седмица (Пон–Пет)</span>
          </button>
        </>) : (
          <div className="space-y-2 mb-4">
            {LEAVE_TYPES.map(leave => (
              <button key={leave.type} onClick={() => setEditLeaveType(leave.type)}
                className={`w-full py-3 rounded-xl text-xs font-medium border ${editLeaveType === leave.type ? leave.color + ' ring-1 ring-white/10' : 'bg-white/[0.03] border-white/[0.06] text-white/60'}`}>
                {leave.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {hasExisting && !wholeWeek && (
            <button onClick={onDelete} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Изтрий</button>
          )}
          <button onClick={() => { onClose(); setWholeWeek(false) }} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={onSave} disabled={saving || bulkSaving} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {(saving || bulkSaving) ? '...' : wholeWeek ? '⚡ Попълни седмица' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/ShiftEditModal.tsx
git commit -m "refactor(shifts): extract ShiftEditModal component"
```

---

### Task 7: Create `components/StaffModal.tsx`

Combined add + edit staff modal. Uses internal form state initialized from props.

**Files:**
- Create: `app/(dashboard)/shifts/components/StaffModal.tsx`

```tsx
// app/(dashboard)/shifts/components/StaffModal.tsx
import { useState, useEffect } from 'react'
import { Staff, STAFF_ROLES } from '../utils'

interface Props {
  mode: 'add' | 'edit'
  staff?: Staff
  saving: boolean
  onSubmit: (name: string, role: string, phone: string) => void
  onToggleActive?: () => void
  onClose: () => void
}

export function StaffModal({ mode, staff, saving, onSubmit, onToggleActive, onClose }: Props) {
  const [name, setName] = useState(staff?.name ?? '')
  const [role, setRole] = useState(staff?.role ?? 'Reception')
  const [phone, setPhone] = useState(staff?.phone ?? '')

  useEffect(() => {
    setName(staff?.name ?? '')
    setRole(staff?.role ?? 'Reception')
    setPhone(staff?.phone ?? '')
  }, [staff])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-5">
          {mode === 'add' ? 'Нов служител' : 'Редактирай служител'}
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Име</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Име и фамилия"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Роля</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Телефон</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-2">
          {mode === 'edit' && staff && onToggleActive && (
            <button onClick={onToggleActive}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium border ${staff.active ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
              {staff.active ? 'Деактивирай' : 'Активирай'}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={() => onSubmit(name.trim(), role, phone.trim())} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {saving ? '...' : mode === 'add' ? 'Добави' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/StaffModal.tsx
git commit -m "refactor(shifts): extract StaffModal component (combined add+edit)"
```

---

### Task 8: Create `components/ShiftsSettingsModal.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/ShiftsSettingsModal.tsx`

```tsx
// app/(dashboard)/shifts/components/ShiftsSettingsModal.tsx
import { GymSettings } from '../utils'

interface Props {
  settingsForm: GymSettings
  savingSettings: boolean
  setSettingsForm: (s: GymSettings) => void
  onSave: () => void
  onClose: () => void
}

type DayConfig = {
  label: string
  openKey: keyof GymSettings
  closeKey: keyof GymSettings
  extraKey: 'weekday_shift_duration_minutes' | 'saturday_shifts' | 'sunday_shifts'
  extraLabel: string
  extraType: 'number' | 'select'
}

const DAY_CONFIGS: DayConfig[] = [
  { label: 'Понеделник — Петък', openKey: 'weekday_open', closeKey: 'weekday_close', extraKey: 'weekday_shift_duration_minutes', extraLabel: 'Смяна (мин)', extraType: 'number' },
  { label: 'Събота', openKey: 'saturday_open', closeKey: 'saturday_close', extraKey: 'saturday_shifts', extraLabel: 'Смени', extraType: 'select' },
  { label: 'Неделя', openKey: 'sunday_open', closeKey: 'sunday_close', extraKey: 'sunday_shifts', extraLabel: 'Смени', extraType: 'select' },
]

export function ShiftsSettingsModal({ settingsForm, savingSettings, setSettingsForm, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-5">Работно време</div>
        <div className="space-y-4 mb-5">
          {DAY_CONFIGS.map(({ label, openKey, closeKey, extraKey, extraLabel, extraType }) => (
            <div key={label}>
              <div className="text-xs text-white/70 mb-2">{label}</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Отваря</label>
                  <input type="time" value={(settingsForm[openKey] as string)?.slice(0, 5)}
                    onChange={e => setSettingsForm({ ...settingsForm, [openKey]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Затваря</label>
                  <input type="time" value={(settingsForm[closeKey] as string)?.slice(0, 5)}
                    onChange={e => setSettingsForm({ ...settingsForm, [closeKey]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">{extraLabel}</label>
                  {extraType === 'number' ? (
                    <input type="number" value={settingsForm[extraKey] as number}
                      onChange={e => setSettingsForm({ ...settingsForm, [extraKey]: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                  ) : (
                    <select value={settingsForm[extraKey] as number}
                      onChange={e => setSettingsForm({ ...settingsForm, [extraKey]: parseInt(e.target.value) })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
                      <option value={1}>1 (цял ден)</option>
                      <option value={2}>2 (първа/втора)</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={onSave} disabled={savingSettings}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {savingSettings ? '...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/ShiftsSettingsModal.tsx
git commit -m "refactor(shifts): extract ShiftsSettingsModal component"
```

---

### Task 9: Create `components/MissingShifts.tsx`

**Files:**
- Create: `app/(dashboard)/shifts/components/MissingShifts.tsx`

```tsx
// app/(dashboard)/shifts/components/MissingShifts.tsx
import { MONTHS_BG, DAYS_BG_SHORT as DAYS_BG } from '@/lib/formatters'
import { MissingDay } from '../hooks/useShifts'

interface Props {
  missingByDate: MissingDay[]
}

export function MissingShifts({ missingByDate }: Props) {
  if (missingByDate.length === 0) return null

  return (
    <div className="mt-6 bg-white/[0.02] border border-orange-500/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-orange-500/20 flex items-center gap-2">
        <span className="text-base">⚠️</span>
        <span className="text-xs font-semibold text-orange-300">Дни с липсващи смени</span>
        <span className="text-[10px] text-orange-400/60 ml-auto">
          {missingByDate.length} {missingByDate.length === 1 ? 'ден' : 'дни'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {missingByDate.map(({ date, day }) => {
          const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
          return (
            <div key={date} className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-orange-400/60 font-mono">{DAYS_BG[dowIdx]}</span>
              <span className="text-xs font-medium text-orange-300">{day.getDate()} {MONTHS_BG[day.getMonth()].slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript + Commit**

```bash
npx tsc --noEmit
git add app/(dashboard)/shifts/components/MissingShifts.tsx
git commit -m "refactor(shifts): extract MissingShifts component"
```

---

### Task 10: Rewrite `page.tsx` as composition shell

This is the final step. Replace the 810-line file with a clean composition shell.

**Files:**
- Modify: `app/(dashboard)/shifts/page.tsx`

**Step 1: Replace the entire file**

```tsx
// app/(dashboard)/shifts/page.tsx
'use client'

import { useShifts } from './hooks/useShifts'
import { ShiftsHeader } from './components/ShiftsHeader'
import { StaffSummaryCards } from './components/StaffSummaryCards'
import { ShiftsCalendarGrid } from './components/ShiftsCalendarGrid'
import { ShiftEditModal } from './components/ShiftEditModal'
import { StaffModal } from './components/StaffModal'
import { ShiftsSettingsModal } from './components/ShiftsSettingsModal'
import { MissingShifts } from './components/MissingShifts'

export default function ShiftsPage() {
  const s = useShifts()

  return (
    <div className="min-h-screen">
      <ShiftsHeader
        monthLabel={s.monthLabel}
        holidays={s.holidays}
        userRole={s.userRole}
        copying={s.copying}
        copyResult={s.copyResult}
        reorderMode={s.reorderMode}
        savingOrder={s.savingOrder}
        onPrevMonth={s.prevMonth}
        onNextMonth={s.nextMonth}
        onCopyMonth={s.handleCopyMonth}
        onDeleteMonth={() => s.setShowDeleteMonth(true)}
        onToggleReorder={() => s.setReorderMode(r => !r)}
        onSaveOrder={s.handleSaveOrder}
        onAddStaff={() => s.setShowAddStaff(true)}
        onOpenSettings={() => { s.setSettingsForm(s.settings); s.setShowSettings(true) }}
      />

      <div className="p-6">
        {s.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (<>
          {s.reorderMode && (
            <div className="mb-3 flex items-center gap-2 bg-amber-400/[0.04] border border-amber-400/10 rounded-xl px-4 py-2.5">
              <span className="text-[11px] text-amber-400/80">↕ Плъзни картите за да промениш реда на служителите в таблицата</span>
            </div>
          )}

          <StaffSummaryCards
            staffSummary={s.staffSummary}
            reorderMode={s.reorderMode}
            draggedStaffId={s.draggedStaffId}
            userRole={s.userRole}
            onEdit={s.setEditStaff}
            onDragStart={s.setDraggedStaffId}
            onDrop={s.handleReorderDrop}
          />

          <ShiftsCalendarGrid
            staff={s.staff}
            days={s.days}
            year={s.year}
            month={s.month}
            today={s.today}
            userRole={s.userRole}
            editCell={s.editCell}
            getShift={s.getShift}
            getHoliday={s.getHoliday}
            onCellClick={s.handleCellClick}
          />

          <MissingShifts missingByDate={s.missingByDate} />
        </>)}
      </div>

      {/* Modals */}
      {s.editCell && s.settings && (
        <ShiftEditModal
          editCell={s.editCell}
          settings={s.settings}
          staff={s.staff}
          editMode={s.editMode}
          editPreset={s.editPreset}
          editStart={s.editStart}
          editEnd={s.editEnd}
          editLeaveType={s.editLeaveType}
          wholeWeek={s.wholeWeek}
          saving={s.saving}
          bulkSaving={s.bulkSaving}
          setEditMode={s.setEditMode}
          setEditStart={s.setEditStart}
          setEditEnd={s.setEditEnd}
          setEditLeaveType={s.setEditLeaveType}
          setWholeWeek={s.setWholeWeek}
          onPresetSelect={s.handlePresetSelect}
          onSave={s.handleSaveShift}
          onDelete={s.handleDeleteShift}
          onClose={() => { s.setEditCell(null); s.setWholeWeek(false) }}
          getShift={s.getShift}
          getHoliday={s.getHoliday}
        />
      )}

      {s.showAddStaff && (
        <StaffModal
          mode="add"
          saving={false}
          onSubmit={s.handleAddStaff}
          onClose={() => s.setShowAddStaff(false)}
        />
      )}

      {s.editStaff && (
        <StaffModal
          mode="edit"
          staff={s.editStaff}
          saving={s.savingStaff}
          onSubmit={(name, role, phone) => s.handleSaveStaff(name, role, phone)}
          onToggleActive={() => s.handleToggleStaffActive(s.editStaff!)}
          onClose={() => s.setEditStaff(null)}
        />
      )}

      {s.showSettings && s.settingsForm && (
        <ShiftsSettingsModal
          settingsForm={s.settingsForm}
          savingSettings={s.savingSettings}
          setSettingsForm={s.setSettingsForm}
          onSave={s.handleSaveSettings}
          onClose={() => s.setShowSettings(false)}
        />
      )}

      {s.showDeleteMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !s.deletingMonth && s.setShowDeleteMonth(false)}>
          <div className="bg-[#0f0f14] border border-red-500/20 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-lg">🗑</div>
              <div>
                <div className="text-sm font-semibold text-white">Изтрий всички смени</div>
                <div className="text-xs text-white/40 mt-0.5">{s.monthLabel}</div>
              </div>
            </div>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Това ще изтрие <span className="text-red-400 font-medium">всички {s.shifts.length} смени</span> за {s.monthLabel}. Действието не може да бъде отменено.
            </p>
            <div className="flex gap-2">
              <button onClick={() => s.setShowDeleteMonth(false)} disabled={s.deletingMonth}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06] disabled:opacity-40">Откажи</button>
              <button onClick={s.handleDeleteMonth} disabled={s.deletingMonth}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25 disabled:opacity-40">
                {s.deletingMonth ? '...' : 'Изтрий всички'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit`
Expected: no errors

**Step 3: Start dev server and verify the page visually**

Run: `. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npm run dev`

Open http://localhost:3000/shifts and verify:
- Calendar grid renders correctly
- Month navigation works
- Clicking a cell opens the edit modal (as admin)
- Staff summary cards show
- Missing shifts section shows if applicable
- All modals open and close

**Step 4: Stop dev server, then commit**

```bash
git add app/(dashboard)/shifts/page.tsx
git commit -m "refactor(shifts): rewrite page as 50-line composition shell"
```

---

## Final Result

```
app/(dashboard)/shifts/
├── page.tsx              ~60 lines  (was 810)
├── utils.ts              ~90 lines
├── hooks/
│   └── useShifts.ts     ~190 lines
└── components/
    ├── ShiftsHeader.tsx         ~70 lines
    ├── StaffSummaryCards.tsx    ~55 lines
    ├── ShiftsCalendarGrid.tsx   ~80 lines
    ├── ShiftEditModal.tsx       ~95 lines
    ├── StaffModal.tsx           ~65 lines
    ├── ShiftsSettingsModal.tsx  ~75 lines
    └── MissingShifts.tsx        ~30 lines
```

Total: ~810 lines split across 9 files. Zero behavior change.
