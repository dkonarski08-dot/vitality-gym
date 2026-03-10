# Design: Shifts Page Split

**Date**: 2026-03-10
**Goal**: Break `app/(dashboard)/shifts/page.tsx` (810 lines) into small, focused files following the pattern already used in `/deliveries` and `/pt`.

---

## Target File Structure

```
app/(dashboard)/shifts/
├── page.tsx                    (~40 lines — composition only)
├── hooks/
│   └── useShifts.ts            (~180 lines — all state + handlers)
├── utils.ts                    (~70 lines — constants + pure functions)
└── components/
    ├── ShiftsHeader.tsx        (~60 lines — month nav, admin buttons, holidays banner)
    ├── StaffSummaryCards.tsx   (~70 lines — cards grid + drag reorder)
    ├── ShiftsCalendarGrid.tsx  (~90 lines — calendar table)
    ├── ShiftEditModal.tsx      (~100 lines — shift edit/save/delete)
    ├── StaffModal.tsx          (~90 lines — add + edit staff combined, mode: 'add' | 'edit')
    ├── ShiftsSettingsModal.tsx (~70 lines — working hours config)
    └── MissingShifts.tsx       (~30 lines — warning section at bottom)
```

---

## Data Flow

```
useShifts.ts
  └── exposes:
        staff, shifts, holidays, settings, loading, saving
        all modal state (editCell, showAddStaff, editStaff, showSettings, ...)
        all handlers (handleCellClick, handleSaveShift, handleAddStaff, ...)
        derived data (staffSummary, missingByDate)

page.tsx
  └── calls useShifts()
  └── renders components, passing props from hook

components/
  └── pure presentational — props in, callbacks out, no fetch calls
```

---

## Key Decisions

- **Types** (Staff, Shift, Holiday, GymSettings) stay colocated in `useShifts.ts` — only used within this module
- **Constants + utils** (LEAVE_TYPES, STAFF_ROLES, addMinutes, calcHours, getShiftTimes, getShiftDisplay, getDaysInMonth) extracted to `utils.ts` — shared by hook and components without circular deps
- **StaffModal** combines AddStaff + EditStaff into one component with `mode: 'add' | 'edit'` prop — removes ~40 lines of duplicated JSX
- **No logic changes** — pure refactor, zero behavior change

---

## Constraints

- All existing functionality preserved exactly
- No new dependencies
- TypeScript strict — no `any`
- Bulgarian UI text unchanged
