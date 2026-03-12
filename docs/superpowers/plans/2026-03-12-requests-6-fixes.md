# Requests Module — 6 Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 UX/data bugs in the Заявки (Requests) module — editable product name, Cyrillic search UX, DraftPanel scroll, draft visibility in history, exact date display, and duplicate supplier cleanup.

**Architecture:** Pure frontend fixes in existing component files + one API route dedup + one DB SQL cleanup. No new files, no schema changes (except supplier data fix). All changes are contained within `app/(dashboard)/requests/` and `app/api/requests/route.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase (PostgREST)

---

## Chunk 1: Layout & Scroll Fix

### Task 1: Fix DraftPanel scroll on desktop

**Problem:** `NewRequestView.tsx:80` — parent container uses `lg:max-h-[calc(100vh-73px)]` (max-height only). Since flex children with `h-full` and `flex-1` need a parent with a defined `height` (not just `max-height`) to activate `overflow-y-auto`, the items list never scrolls.

**Files:**
- Modify: `app/(dashboard)/requests/components/NewRequestView.tsx:80`

- [ ] **Step 1: Change `lg:max-h-` to `lg:h-` on the DraftPanel wrapper**

In `NewRequestView.tsx`, find the DraftPanel wrapper div (line 80):
```tsx
// BEFORE
<div className="lg:w-[40%] p-6 lg:sticky lg:top-[73px] lg:self-start lg:max-h-[calc(100vh-73px)] lg:overflow-hidden flex flex-col">

// AFTER
<div className="lg:w-[40%] p-6 lg:sticky lg:top-[73px] lg:self-start lg:h-[calc(100vh-73px)] lg:overflow-hidden flex flex-col">
```

This gives the container a fixed height on desktop so DraftPanel's `h-full flex flex-col` layout and the items list's `flex-1 overflow-y-auto min-h-0` actually constrain and scroll.

- [ ] **Step 2: Verify DraftPanel root already has correct classes**

In `DraftPanel.tsx:23`, confirm the root div:
```tsx
<div className="flex flex-col h-full bg-white/[0.02] border border-white/10 rounded-xl p-4">
```
And the items container (line 42):
```tsx
<div className="flex-1 overflow-y-auto space-y-1 mb-4 min-h-0">
```
Both are correct — no changes needed here.

- [ ] **Step 3: Commit**
```bash
git add app/\(dashboard\)/requests/components/NewRequestView.tsx
git commit -m "fix(requests): DraftPanel scroll — fixed height on desktop container"
```

---

## Chunk 2: Editable Product Name in Draft

### Task 2: Add onUpdateName to DraftPanel and wire it through

**Problem:** `DraftPanel.tsx:47` renders product name as a `<div>` — read-only. Need inline editable `<input>`.

**Files:**
- Modify: `app/(dashboard)/requests/components/DraftPanel.tsx`
- Modify: `app/(dashboard)/requests/hooks/useRequests.ts`
- Modify: `app/(dashboard)/requests/components/NewRequestView.tsx`
- Modify: `app/(dashboard)/requests/page.tsx`

- [ ] **Step 1: Add `updateName` callback to `useRequests.ts`**

After `updateNote` (line ~117), add:
```ts
const updateName = useCallback((idx: number, name: string) => {
  setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, product_name: name } : item))
}, [])
```

And expose it in the return object (add `updateName` to the return at the bottom of the hook alongside `updateNote`).

- [ ] **Step 2: Add `onUpdateName` prop to `DraftPanel`**

In `DraftPanel.tsx`, add to the `Props` interface (after `onUpdateNote`):
```ts
onUpdateName: (idx: number, name: string) => void
```

And destructure it in the function signature.

- [ ] **Step 3: Replace the product name `<div>` with an `<input>`**

In `DraftPanel.tsx`, replace (line ~47):
```tsx
// BEFORE
<div className="text-xs text-white/80 truncate">{item.product_name}</div>

// AFTER
<input
  type="text"
  value={item.product_name}
  onChange={e => onUpdateName(idx, e.target.value)}
  className="text-xs text-white/80 bg-transparent focus:outline-none focus:text-white w-full min-w-0 overflow-hidden"
/>
```

- [ ] **Step 4: Add `onUpdateName` to `NewRequestView` Props and pass-through**

In `NewRequestView.tsx`, add to Props interface (after `onUpdateNote`):
```ts
onUpdateName: (idx: number, name: string) => void
```

Destructure it, and pass to DraftPanel:
```tsx
<DraftPanel
  ...
  onUpdateNote={onUpdateNote}
  onUpdateName={onUpdateName}
  ...
/>
```

- [ ] **Step 5: Pass `updateName` from page.tsx to NewRequestView**

In `page.tsx`, add to `<NewRequestView>`:
```tsx
onUpdateName={r.updateName}
```

- [ ] **Step 6: Commit**
```bash
git add app/\(dashboard\)/requests/components/DraftPanel.tsx \
        app/\(dashboard\)/requests/hooks/useRequests.ts \
        app/\(dashboard\)/requests/components/NewRequestView.tsx \
        app/\(dashboard\)/requests/page.tsx
git commit -m "feat(requests): editable product name in DraftPanel"
```

---

## Chunk 3: Cyrillic Search UX

### Task 3: Show "no results" message when search returns 0 products

**Problem:** `ProductPicker.tsx:118` — `{showSuggestions && suggestions.length > 0 && ...}` hides the dropdown entirely when 0 results are found. User types Cyrillic (e.g. "мляко") and sees nothing — thinks search is broken. Need to show a "not found" message with inline add option.

**Files:**
- Modify: `app/(dashboard)/requests/components/ProductPicker.tsx`

- [ ] **Step 1: Track "searched but empty" state**

The `searching` flag already exists. After the search fetch completes, `suggestions` will be `[]` and `showSuggestions` will be `true`. The fix is purely in the render condition.

- [ ] **Step 2: Show "no results" dropdown when showSuggestions + suggestions.length === 0 + !searching**

Replace the suggestions dropdown block (lines ~118–148) with:
```tsx
{showSuggestions && !searching && (
  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f14] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
    {suggestions.length > 0 ? (
      <>
        {suggestions.map(p => (
          <button
            key={p.id}
            onClick={() => handleAddFromSuggestion(p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            <div>
              <div className="text-sm text-white">{p.clean_name ?? p.name}</div>
              <div className="text-[10px] text-white/30">{p.category} · {p.unit}</div>
            </div>
            <div className="text-right shrink-0 ml-4">
              {p.last_price && <div className="text-xs text-white/50">{p.last_price.toFixed(2)}€</div>}
              <div className="text-[10px] text-white/25">{p.order_count}×</div>
            </div>
          </button>
        ))}
        {search.trim() && !suggestions.some(s => (s.clean_name ?? s.name).toLowerCase() === search.toLowerCase()) && (
          <button
            onClick={() => { onAddProduct(search.trim(), 'бр', null); setSearch(''); setShowSuggestions(false) }}
            className="w-full flex items-center px-4 py-3 hover:bg-white/5 text-left border-t border-white/[0.06]"
          >
            <span className="text-xs text-amber-400">+ Добави &quot;{search}&quot; като нов продукт</span>
          </button>
        )}
      </>
    ) : (
      <div className="px-4 py-3">
        <div className="text-xs text-white/40 mb-2">Няма намерени продукти за &quot;{search}&quot;</div>
        <button
          onClick={() => { onAddProduct(search.trim(), 'бр', null); setSearch(''); setShowSuggestions(false) }}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          + Добави &quot;{search}&quot; ръчно
        </button>
      </div>
    )}
  </div>
)}

{showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}
```

- [ ] **Step 3: Ensure `setShowSuggestions(true)` is called even for empty results**

In the search `useEffect` (lines ~62–79), after `setSuggestions(data.products || [])` check that `setShowSuggestions(true)` is always called (it already is — confirm no change needed).

- [ ] **Step 4: Commit**
```bash
git add app/\(dashboard\)/requests/components/ProductPicker.tsx
git commit -m "fix(requests): show no-results message for empty search (Cyrillic support UX)"
```

---

## Chunk 4: History View — Show Drafts & Exact Date

### Task 4: Show saved drafts in HistoryView

**Problem:** `useRequests.ts:302` — `pastRequests = requests.filter(r => r.status !== 'draft')`. Drafts are stripped before reaching HistoryView. After saving a draft, it doesn't appear in the list.

**Files:**
- Modify: `app/(dashboard)/requests/hooks/useRequests.ts`
- Modify: `app/(dashboard)/requests/page.tsx`

- [ ] **Step 1: Remove the draft filter in `useRequests.ts`**

Find line ~302:
```ts
// BEFORE
const pastRequests = requests.filter(r => r.status !== 'draft')

// AFTER
const allRequests = requests
```

And update the return object — rename `pastRequests` → `allRequests`:
```ts
return {
  ...
  allRequests,   // was: pastRequests
  ...
}
```

- [ ] **Step 2: Update `page.tsx` to use `allRequests`**

In `page.tsx`, find:
```tsx
requests={r.pastRequests}
```
Change to:
```tsx
requests={r.allRequests}
```

- [ ] **Step 3: Commit**
```bash
git add app/\(dashboard\)/requests/hooks/useRequests.ts \
        app/\(dashboard\)/requests/page.tsx
git commit -m "fix(requests): show draft in history list"
```

### Task 5: Show exact created_at date in HistoryView

**Problem:** `HistoryView.tsx:63` — shows `formatMonth(r.month)` → "Март 2026". `created_at` is already in `DeliveryRequest` type — just not displayed.

**Files:**
- Modify: `app/(dashboard)/requests/components/HistoryView.tsx`

- [ ] **Step 1: Add a `formatDate` helper in HistoryView**

Below the existing `formatMonth` helper (line ~36), add:
```ts
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}
```

- [ ] **Step 2: Display the exact date alongside the status**

In `HistoryView.tsx`, find the request card content (line ~62–70):
```tsx
// BEFORE
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-sm font-medium text-white">{formatMonth(r.month)}</span>
  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>
    {STATUS_LABELS[r.status]}
  </span>
</div>
<div className="text-xs text-white/40 mt-1">
  {r.created_by} · {r.delivery_request_items.length} продукта
</div>

// AFTER
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-sm font-medium text-white">{formatDate(r.created_at)}</span>
  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>
    {STATUS_LABELS[r.status]}
  </span>
</div>
<div className="text-xs text-white/40 mt-1">
  {r.created_by} · {r.delivery_request_items.length} продукта
</div>
```

- [ ] **Step 3: Remove the unused `formatMonth` function and `MONTHS_BG` array from HistoryView**

Delete the `MONTHS_BG` constant (line ~31) and `formatMonth` function (lines ~33–36) from `HistoryView.tsx` since they're no longer used.

- [ ] **Step 4: Commit**
```bash
git add app/\(dashboard\)/requests/components/HistoryView.tsx
git commit -m "fix(requests): show exact creation date in history (not just month)"
```

---

## Chunk 5: Duplicate Suppliers Cleanup

### Task 6: Fix duplicate suppliers — DB data + API dedup guard

**Problem (two-part):**
1. `suppliers` table has duplicate rows: "ВМ Спорт ЕООД" (inactive) + "ВМ СПОРТ ЕООД" (active), and "Брейктайм АД" (active) + "БРЕЙКТАЙМ АД" (active)
2. `deliveries.supplier_name` has "BM СПОРТ ЕООД" (Latin B — likely a typo) separate from "ВМ СПОРТ ЕООД" — causes the requests picker to show both as separate suppliers

**Files:**
- DB fix via Supabase MCP SQL
- Modify: `app/api/requests/route.ts` (add dedup guard in `type=suppliers`)

#### Part A: DB cleanup

- [ ] **Step 1: Delete the inactive duplicate supplier row**

```sql
DELETE FROM suppliers
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND name = 'ВМ Спорт ЕООД'
  AND active = false;
```

Expected: 1 row deleted ("ВМ Спорт ЕООД" — inactive duplicate).

- [ ] **Step 2: Deactivate the duplicate БРЕЙКТАЙМ АД row (keep "БРЕЙКТАЙМ АД", remove "Брейктайм АД")**

First run the SELECT and review the results before executing the DELETE:
```sql
-- Run this first and confirm 2 rows appear before proceeding
SELECT id, name, active FROM suppliers
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND lower(name) = lower('БРЕЙКТАЙМ АД');
```

Only after confirming the SELECT returns 2 rows (one "Брейктайм АД", one "БРЕЙКТАЙМ АД"):
```sql
-- Delete the mixed-case one (keep the ALL CAPS version matching deliveries.supplier_name)
DELETE FROM suppliers
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND name = 'Брейктайм АД';
```

- [ ] **Step 3: Fix the "BM СПОРТ ЕООД" typo in deliveries**

The `deliveries.supplier_name` text field has "BM СПОРТ ЕООД" (Latin B) which is a typo for "ВМ СПОРТ ЕООД" (Cyrillic В). Fix it:
```sql
UPDATE deliveries
SET supplier_name = 'ВМ СПОРТ ЕООД'
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND supplier_name = 'BM СПОРТ ЕООД';
```

Expected: 1 row updated.

- [ ] **Step 4: Verify no more duplicates**

```sql
SELECT lower(name), COUNT(*)
FROM suppliers
WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND active = true
GROUP BY lower(name)
HAVING COUNT(*) > 1;
```

Expected: 0 rows (no duplicates).

```sql
SELECT supplier_name, COUNT(*)
FROM deliveries
WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND supplier_name IS NOT NULL
GROUP BY supplier_name
ORDER BY supplier_name;
```

Expected: No "BM СПОРТ ЕООД" entry — only "ВМ СПОРТ ЕООД".

#### Part B: API dedup guard (defensive measure)

- [ ] **Step 5: Add case-insensitive deduplication in `type=suppliers` handler**

In `app/api/requests/route.ts`, in the `type === 'suppliers'` block, after building the `suppliers` array (line ~71), add deduplication before returning:

```ts
// Deduplicate by case-insensitive name (defensive guard)
const seen = new Set<string>()
const uniqueSuppliers = suppliers.filter(s => {
  const key = s.supplier_name.toLowerCase().trim()
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

return NextResponse.json({ suppliers: uniqueSuppliers })
```

Replace the existing `return NextResponse.json({ suppliers })` with this block.

- [ ] **Step 6: Commit**
```bash
git add app/api/requests/route.ts
git commit -m "fix(requests): dedup suppliers case-insensitively in API + DB cleanup"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `NewRequestView.tsx` | `lg:max-h-` → `lg:h-` for DraftPanel wrapper + add `onUpdateName` prop |
| `DraftPanel.tsx` | product_name `<div>` → `<input>`, add `onUpdateName` prop |
| `useRequests.ts` | add `updateName` callback, rename `pastRequests` → `allRequests` |
| `page.tsx` | pass `onUpdateName={r.updateName}`, use `r.allRequests` |
| `ProductPicker.tsx` | show "no results" dropdown with manual add when search returns 0 |
| `HistoryView.tsx` | show `created_at` as "dd.mm.yyyy" instead of month, remove `formatMonth` |
| `app/api/requests/route.ts` | case-insensitive dedup in `type=suppliers` response |
| DB (via SQL) | delete supplier duplicates, fix "BM СПОРТ ЕООД" typo in deliveries |
