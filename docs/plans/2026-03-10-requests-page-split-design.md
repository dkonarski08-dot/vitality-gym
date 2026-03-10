# Design: Requests Page Split

**Date**: 2026-03-10
**Goal**: Break `app/(dashboard)/requests/page.tsx` (442 lines) into small, focused files following the same pattern used in `/shifts`.

---

## Target File Structure

```
app/(dashboard)/requests/
├── page.tsx                    (~35 lines — composition only)
├── types.ts                    (~20 lines — interfaces)
├── hooks/
│   └── useRequests.ts          (~130 lines — all state + handlers)
└── components/
    ├── RequestsHeader.tsx       (~35 lines — title + admin cleanup button)
    ├── ProductSearch.tsx        (~110 lines — search + autocomplete + category tabs + top products grid)
    ├── PastRequests.tsx         (~80 lines — history list with expandable items)
    └── DraftPanel.tsx           (~100 lines — sticky right column)
```

---

## Data Flow

```
useRequests.ts
  └── exposes:
        requests, topProducts, loading
        search, suggestions, showSuggestions, searching, searchRef
        draftItems, draftNotes, draftId, saving, submitting, aiSuggestion, setAiSuggestion
        selectedCategory, setSelectedCategory
        selectedRequest, setSelectedRequest
        cleaning, cleanResult
        filteredTop, availableCategories, pastRequests  (useMemo)
        handlers: addProduct, addMultipleProducts, addCustomProduct,
                  updateQty, removeItem, handleSave, handleSubmit,
                  handleDelete, handleCleanup

page.tsx
  └── calls useRequests()
  └── renders 2-column grid with all 4 components

components/
  └── pure presentational — props in, callbacks out, no fetch calls
```

---

## Key Decisions

- **Types** (Product, RequestItem, DeliveryRequest) colocated in `types.ts` — only used within this module
- **`searchRef` + `debounceRef`** stay in the hook so `addProduct` can refocus the input after adding
- **`filteredTop`, `availableCategories`, `pastRequests`** wrapped in `useMemo` in the hook (currently recomputed on every render)
- **`ProductSearch`** receives `draftItems` to highlight already-added products (amber border)
- **`DraftPanel`** receives `aiSuggestion` + `setAiSuggestion` for the dismiss button
- **No logic changes** — pure refactor, zero behavior change

---

## Constraints

- All existing functionality preserved exactly
- No new dependencies
- TypeScript strict — no `any`
- Bulgarian UI text unchanged
