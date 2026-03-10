# Design: Cash Page Split

**Date**: 2026-03-10
**Goal**: Break `app/(dashboard)/cash/page.tsx` (626 lines) into small, focused files following the same pattern used in `/shifts` and `/requests`.

---

## Target File Structure

```
app/(dashboard)/cash/
├── page.tsx                        (~30 lines — composition only)
├── types.ts                        (~20 lines — CashRecord interface)
├── hooks/
│   └── useCash.ts                  (~130 lines — all state + handlers)
└── components/
    ├── CashHeader.tsx              (~25 lines — sticky header, shared between roles)
    ├── ReceptionistView.tsx        (~85 lines — full receptionist path)
    ├── AdminKpiCards.tsx           (~30 lines — 3 KPI stat cards)
    ├── AdminCountPanel.tsx         (~80 lines — date picker + physical count + data comparison)
    ├── GymRealmImportPanel.tsx     (~60 lines — drag/drop XLSX import)
    ├── AlertsSection.tsx           (~30 lines — anomalies list, returns null if empty)
    └── CashHistoryTable.tsx        (~55 lines — monthly history table)
```

---

## Data Flow

```
useCash.ts
  └── exposes:
        userRole, loading, error, setError
        records, saving, saved, setSaved
        gymSystem, setGymSystem, gymCounted, setGymCounted, notes, setNotes
        adminDate, adminCounted, setAdminCounted, adminSaving, adminSaved
        importFile, setImportFile, importing, importResult, dragOver, setDragOver
        fileInputRef
        viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth,
        goToPrevMonth, goToNextMonth, resetToMonth
        today, yesterdayStr, yesterdayRec, hasYesterdayAlert
        alertRecords, recordsWithData, adminRec, grDiff
        handlers: handleStaffSave, handleAdminSave, handleImport,
                  handleAckAlert, handleAdminDateChange

page.tsx
  └── calls useCash()
  └── if userRole !== 'admin' → <ReceptionistView .../>
  └── else → <CashHeader/> + month nav + <AdminKpiCards/> + grid(<AdminCountPanel/> + <GymRealmImportPanel/>) + <AlertsSection/> + <CashHistoryTable/>

components/
  └── pure presentational — props in, callbacks out, no fetch calls
```

---

## Key Decisions

- **`CashHeader`** — shared between both views. Props: `title`, `subtitle`, `saved?: boolean`. Shows "Записано" badge only when `saved` is truthy.
- **`ReceptionistView`** — self-contained. Receives all receptionist state + `hasYesterdayAlert` + `yesterdayRec` + handlers. Renders its own `CashHeader`, alert banner, and form.
- **`AdminCountPanel`** — receives `adminRec`, `adminDate`, `adminCounted`, `grDiff`, `adminSaved`, `adminSaving`, `monthStart`/`monthEnd`/`today`/`isCurrentMonth` + `onChange`/`onSave`. Renders date picker, physical count input, receptionist data comparison, save button.
- **`GymRealmImportPanel`** — receives `importFile`, `importing`, `importResult`, `dragOver`, `fileInputRef` + setters + `onImport`. XLSX parsing logic stays in the hook.
- **`AlertsSection`** — returns `null` if `alertRecords.length === 0`.
- **`CashHistoryTable`** — receives `records`, `adminDate`, `today` + `onRowClick` (calls `handleAdminDateChange`).
- **`types.ts`** — just `CashRecord` interface, currently inlined in page.tsx.
- **No logic changes** — pure refactor, zero behavior change.

---

## Constraints

- All existing functionality preserved exactly
- No new dependencies
- TypeScript strict — no `any`
- Bulgarian UI text unchanged
