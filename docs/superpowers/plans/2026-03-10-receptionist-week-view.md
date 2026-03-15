# Receptionist Week View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the receptionist's shifts view with a Sling-style week-by-week schedule showing only employees who have real work shifts on each day, sorted by start time.

**Architecture:** Create a new `ReceptionistWeekView` component that groups the month's days into Mon–Sun weeks, and for each day column renders only the staff members who have a (non-leave) shift, sorted by `start_time`. The `page.tsx` branches on `userRole` to show either the new component (receptionist) or the unchanged admin layout.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, existing Supabase data via `useShifts` hook, Playwright MCP for visual verification.

---

## Chunk 1: ReceptionistWeekView component

### Task 1: Create the ReceptionistWeekView component

**Files:**
- Create: `components/shifts/ReceptionistWeekView.tsx`

**Key decisions baked in:**
- Leave types (`sick`, `paid_leave`, `unpaid_leave`) are **excluded** — only shifts with real work times appear.
- Pill role color = staff member's role (left border), NOT shift type.
- Weeks are Mon–Sun groups; days outside the current month are rendered as dimmed empty columns (no pills).
- Employees within a day are sorted ascending by `start_time` (string comparison works: `"08:00" < "14:00"`).
- Today's column gets `bg-amber-400/10` header + `bg-amber-400/[0.04]` body.

- [ ] **Step 1: Create the components/shifts directory**

```bash
mkdir -p ~/vitality-gym/components/shifts
```

- [ ] **Step 2: Create the component file**

Create `components/shifts/ReceptionistWeekView.tsx` with this exact content:

```tsx
// components/shifts/ReceptionistWeekView.tsx
'use client'

import { DAYS_BG_SHORT } from '@/lib/formatters'
import { Staff, Shift, LEAVE_TYPES } from '@/app/(dashboard)/shifts/utils'

interface Props {
  staff: Staff[]
  shifts: Shift[]
  year: number
  month: number
  days: Date[]
  today: string
}

const LEAVE_TYPE_SET = new Set(LEAVE_TYPES.map(l => l.type))

function roleLeftBorder(role: string): string {
  if (role === 'admin') return 'border-l-amber-400'
  if (role === 'instructor') return 'border-l-emerald-400'
  if (role === 'cleaning') return 'border-l-violet-400'
  // 'Reception' (capital R) and any unknown role → sky
  return 'border-l-sky-400'
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns Mon–Sun week arrays covering the month. Days outside the month are included as padding. */
function getWeeks(days: Date[]): Date[][] {
  if (days.length === 0) return []
  const first = days[0]
  const dow = first.getDay() === 0 ? 7 : first.getDay() // 1=Mon … 7=Sun
  const monday = new Date(first)
  monday.setDate(first.getDate() - (dow - 1))
  const last = days[days.length - 1]
  const weeks: Date[][] = []
  let ws = new Date(monday)
  while (ws <= last) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws)
      d.setDate(ws.getDate() + i)
      week.push(d)
    }
    weeks.push(week)
    ws = new Date(ws)
    ws.setDate(ws.getDate() + 7)
  }
  return weeks
}

export function ReceptionistWeekView({ staff, shifts, year, month, days, today }: Props) {
  const weeks = getWeeks(days)
  const staffById = new Map(staff.map(s => [s.id, s]))

  // Build per-date shift list: exclude leave types, sort by start_time ascending
  const shiftsByDate = new Map<string, Shift[]>()
  for (const shift of shifts) {
    if (LEAVE_TYPE_SET.has(shift.shift_type)) continue
    const existing = shiftsByDate.get(shift.date) ?? []
    existing.push(shift)
    shiftsByDate.set(shift.date, existing)
  }
  for (const [date, dayShifts] of shiftsByDate) {
    shiftsByDate.set(date, [...dayShifts].sort((a, b) => a.start_time.localeCompare(b.start_time)))
  }

  return (
    <div className="space-y-3">
      {weeks.map((week, wi) => (
        <div key={wi} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">

          {/* Week header — day name + date number */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {week.map((day, di) => {
              const dateStr = toDateStr(day)
              const isCurrentMonth = day.getMonth() + 1 === month && day.getFullYear() === year
              const isToday = dateStr === today
              const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
              return (
                <div
                  key={di}
                  className={`px-3 py-2 text-center ${isToday ? 'bg-amber-400/10' : ''} ${di < 6 ? 'border-r border-white/[0.04]' : ''}`}
                >
                  <div className={`text-[9px] uppercase tracking-wider ${isCurrentMonth ? 'text-white/40' : 'text-white/15'}`}>
                    {DAYS_BG_SHORT[dowIdx]}
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-amber-400' : isCurrentMonth ? 'text-white/80' : 'text-white/20'}`}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Shift pills per day */}
          <div className="grid grid-cols-7 min-h-[60px]">
            {week.map((day, di) => {
              const dateStr = toDateStr(day)
              const isCurrentMonth = day.getMonth() + 1 === month && day.getFullYear() === year
              const isToday = dateStr === today
              const dayShifts = isCurrentMonth ? (shiftsByDate.get(dateStr) ?? []) : []
              return (
                <div
                  key={di}
                  className={`p-2 space-y-1.5 ${isToday ? 'bg-amber-400/[0.04]' : ''} ${di < 6 ? 'border-r border-white/[0.04]' : ''}`}
                >
                  {dayShifts.map(shift => {
                    const member = staffById.get(shift.staff_id)
                    if (!member) return null
                    return (
                      <div
                        key={shift.id}
                        className={`px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] border-l-2 ${roleLeftBorder(member.role)}`}
                      >
                        <div className="text-[11px] font-medium text-white truncate">{member.name}</div>
                        <div className="text-[10px] text-white/60">
                          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1
```

Expected: no errors. If errors appear, fix them before continuing.

- [ ] **Step 4: Commit the new component**

```bash
cd ~/vitality-gym
git add components/shifts/
git commit -m "feat(shifts): add ReceptionistWeekView week-by-week schedule component"
```

---

## Chunk 2: Wire into page.tsx

### Task 2: Replace receptionist layout in page.tsx

**Files:**
- Modify: `app/(dashboard)/shifts/page.tsx`

The receptionist path removes:
- `<StaffSummaryCards>` (summary cards entirely hidden)
- `<ShiftsCalendarGrid>` (old grid hidden)
- `<MissingShifts>` (missing shifts section hidden)
- The `reorderMode` info banner (not relevant for receptionist)

And replaces them with `<ReceptionistWeekView>`.

The admin path is **completely unchanged**.

- [ ] **Step 1: Add the import to page.tsx**

In `app/(dashboard)/shifts/page.tsx`, add this import after the existing imports:

```tsx
import { ReceptionistWeekView } from '@/components/shifts/ReceptionistWeekView'
```

- [ ] **Step 2: Replace the content section**

Find this block in the `loading` false branch (after the spinner):

```tsx
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
```

Replace it with:

```tsx
        ) : (<>
          {s.userRole === 'receptionist' ? (
            <ReceptionistWeekView
              staff={s.staff}
              shifts={s.shifts}
              year={s.year}
              month={s.month}
              days={s.days}
              today={s.today}
            />
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
        </>)}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/vitality-gym
git add app/(dashboard)/shifts/page.tsx
git commit -m "feat(shifts): show ReceptionistWeekView for receptionist role, keep admin view unchanged"
```

---

## Chunk 3: Playwright verification

### Task 3: Visual verification with Playwright

**Prerequisites:** Dev server must be running on port 3000 (or 3001 if 3000 is taken). Check with:
```bash
lsof -i :3000 | grep LISTEN || lsof -i :3001 | grep LISTEN
```
If not running, start it:
```bash
cd ~/vitality-gym && npm run dev &
sleep 5
```

**Receptionist credentials:** name = `Рецепция`, PIN = `0000`
**Admin credentials:** name = `Dimitar`, PIN = `1234`

- [ ] **Step 1: Open app and log in as receptionist**

Use Playwright MCP:
1. `browser_navigate` to `http://localhost:3000` (or 3001)
2. Click the "Рецепция" user card
3. Click PIN digits: 0, 0, 0, 0
4. Click "Влез" (login button)
5. Navigate to `http://localhost:3000/shifts`
6. `browser_take_screenshot` — save as receptionist-shifts.png

- [ ] **Step 2: Verify receptionist view**

In the screenshot, confirm:
- **No summary cards** at the top (no employee stat cards with "Смени / Часове / Уикенд" stats)
- **Calendar shows weeks** (Mon–Sun groups with 7 day columns each)
- **Day headers** show "Пн / Вт / Ср / Чт / Пт / Сб / Нд" with date numbers
- **Shift pills** appear inside day cells (employee name + HH:MM – HH:MM)
- **Only work shift pills** appear in day cells — no leave-type pills (sick/болничен, paid leave/отпуск) are shown; employees with only leave on a given day show no pill for that day
- **Today's column** has an amber tint

If anything looks wrong, inspect the screenshot and fix the component before continuing.

- [ ] **Step 3: Screenshot the admin view**

1. Navigate to `http://localhost:3000/login`
2. Click "Dimitar", enter PIN 1, 2, 3, 4, click "Влез"
3. Navigate to `http://localhost:3000/shifts`
4. `browser_take_screenshot` — save as admin-shifts.png

- [ ] **Step 4: Verify admin view is unchanged**

In the admin screenshot, confirm:
- **Summary cards** are visible at the top (employee cards with shift/hour counts)
- **Full calendar grid** is visible (rows = employees, columns = days)
- Admin action buttons in header (⚙️, 📋 Копирай предходен, 🗑 Изтрий месеца, ↕ Пренареди, + Служител) are present

- [ ] **Step 5: Final TypeScript check**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1
```

Expected: no errors.
