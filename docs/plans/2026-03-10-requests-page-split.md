# Requests Page Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `app/(dashboard)/requests/page.tsx` (442 lines) into focused files matching the pattern used in `/shifts`.

**Architecture:** Extract types to `types.ts`, all state+handlers to `hooks/useRequests.ts`, each UI section to a component in `components/`. Page becomes a ~35-line composition shell. Zero behavior changes.

**Tech Stack:** Next.js 14, React, TypeScript strict, Tailwind CSS

---

## Reference: Current File Map

`app/(dashboard)/requests/page.tsx`:
- Lines 1–16: imports + interfaces (Product, RequestItem, DeliveryRequest)
- Lines 18–186: state, loadData, search effect, handlers, derived values
- Lines 189–215: JSX header
- Lines 217–362: JSX left column (search, top products, past requests)
- Lines 364–436: JSX right column (draft panel)

---

### Task 1: Create `types.ts`

**Files:**
- Create: `app/(dashboard)/requests/types.ts`

**Step 1: Create the file**

```typescript
// app/(dashboard)/requests/types.ts

export interface Product {
  id: string
  name: string
  category: string
  unit: string
  last_price: number | null
  order_count: number
}

export interface RequestItem {
  product_id: string | null
  product_name: string
  quantity: number
  unit: string
  note: string | null
}

export interface DeliveryRequest {
  id: string
  month: string
  status: string
  created_by: string
  notes: string | null
  ai_suggestions: string | null
  created_at: string
  delivery_request_items: (RequestItem & { id: string })[]
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -10`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/requests/types.ts"
git commit -m "refactor(requests): extract types"
```

---

### Task 2: Create `hooks/useRequests.ts`

**Files:**
- Create: `app/(dashboard)/requests/hooks/useRequests.ts`

**Step 1: Create the directory and file**

```typescript
// app/(dashboard)/requests/hooks/useRequests.ts
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from '@/hooks/useSession'
import { Product, RequestItem, DeliveryRequest } from '../types'

export function useRequests() {
  const { userRole, userName } = useSession()
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Search
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Current draft
  const [draftItems, setDraftItems] = useState<RequestItem[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // View history
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [reqRes, topRes] = await Promise.all([
      fetch('/api/requests'), fetch('/api/requests?type=top'),
    ])
    const [reqData, topData] = await Promise.all([reqRes.json(), topRes.json()])
    setRequests(reqData.requests || [])
    setTopProducts(topData.products || [])

    const draft = (reqData.requests || []).find((r: DeliveryRequest) => r.status === 'draft')
    if (draft) {
      setDraftId(draft.id)
      setDraftItems(draft.delivery_request_items.map((i: RequestItem & { id: string }) => ({
        product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit: i.unit, note: i.note,
      })))
      setDraftNotes(draft.notes || '')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Autocomplete search with debounce
  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/requests?type=search&q=${encodeURIComponent(search)}`)
      const data = await res.json()
      setSuggestions(data.products || [])
      setShowSuggestions(true)
      setSearching(false)
    }, 200)
  }, [search])

  const addProduct = useCallback((product: Product | { name: string; unit: string; id?: string }) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.product_name === product.name)
      if (existing) {
        return prev.map(i => i.product_name === product.name ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        product_id: ('id' in product && product.id) ? product.id : null,
        product_name: product.name,
        quantity: 1,
        unit: product.unit || 'бр',
        note: null,
      }]
    })
    setSearch('')
    setSuggestions([])
    setShowSuggestions(false)
    searchRef.current?.focus()
  }, [])

  const addMultipleProducts = useCallback((items: { product_name: string; unit: string; product_id: string | null }[]) => {
    setDraftItems(prev => {
      let updated = [...prev]
      for (const item of items) {
        const existing = updated.find(i => i.product_name === item.product_name)
        if (existing) {
          updated = updated.map(i => i.product_name === item.product_name ? { ...i, quantity: i.quantity + 1 } : i)
        } else {
          updated.push({ product_id: item.product_id, product_name: item.product_name, quantity: 1, unit: item.unit || 'бр', note: null })
        }
      }
      return updated
    })
  }, [])

  const addCustomProduct = useCallback(() => {
    if (!search.trim()) return
    addProduct({ name: search.trim(), unit: 'бр' })
  }, [search, addProduct])

  const updateQty = useCallback((idx: number, qty: number) => {
    if (qty <= 0) { setDraftItems(prev => prev.filter((_, i) => i !== idx)); return }
    setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
  }, [])

  const removeItem = useCallback((idx: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleSave = useCallback(async () => {
    if (draftItems.length === 0) return
    setSaving(true)
    if (draftId) {
      await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: draftId, notes: draftNotes, items: draftItems }),
      })
    } else {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', created_by: userName, notes: draftNotes, items: draftItems }),
      })
      const data = await res.json()
      if (data.request) setDraftId(data.request.id)
    }
    setSaving(false)
  }, [draftItems, draftId, draftNotes, userName])

  const handleSubmit = useCallback(async () => {
    if (draftItems.length === 0) return
    setSubmitting(true)
    await handleSave()
    if (draftId) {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id: draftId }),
      })
      const data = await res.json()
      if (data.ai_suggestions) setAiSuggestion(data.ai_suggestions)
      setDraftId(null); setDraftItems([]); setDraftNotes('')
      await loadData()
    }
    setSubmitting(false)
  }, [draftItems, draftId, handleSave, loadData])

  const handleDelete = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    if (draftId === id) { setDraftId(null); setDraftItems([]); setDraftNotes('') }
    await loadData()
  }, [draftId, loadData])

  const handleCleanup = useCallback(async () => {
    setCleaning(true); setCleanResult(null)
    const res = await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cleanup_names' }),
    })
    const data = await res.json()
    setCleanResult(data.cleaned > 0 ? `✓ Коригирани ${data.cleaned} имена` : '✓ Всички имена са правилни')
    if (data.cleaned > 0) await loadData()
    setCleaning(false)
    setTimeout(() => setCleanResult(null), 4000)
  }, [loadData])

  const filteredTop = useMemo(() =>
    selectedCategory === 'all' ? topProducts : topProducts.filter(p => p.category === selectedCategory),
  [selectedCategory, topProducts])

  const availableCategories = useMemo(() =>
    [...new Set(topProducts.map(p => p.category).filter(Boolean))],
  [topProducts])

  const pastRequests = useMemo(() =>
    requests.filter(r => r.status !== 'draft'),
  [requests])

  return {
    userRole, loading,
    // search
    search, setSearch, suggestions, showSuggestions, setShowSuggestions, searching, searchRef,
    // draft
    draftItems, draftNotes, setDraftNotes, draftId, saving, submitting, aiSuggestion, setAiSuggestion,
    // category
    selectedCategory, setSelectedCategory,
    // history
    selectedRequest, setSelectedRequest,
    // admin
    cleaning, cleanResult,
    // derived
    filteredTop, availableCategories, pastRequests,
    // handlers
    addProduct, addMultipleProducts, addCustomProduct,
    updateQty, removeItem,
    handleSave, handleSubmit, handleDelete, handleCleanup,
  }
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/requests/hooks/useRequests.ts"
git commit -m "refactor(requests): extract useRequests hook"
```

---

### Task 3: Create all 4 components

**Files:**
- Create: `app/(dashboard)/requests/components/RequestsHeader.tsx`
- Create: `app/(dashboard)/requests/components/ProductSearch.tsx`
- Create: `app/(dashboard)/requests/components/PastRequests.tsx`
- Create: `app/(dashboard)/requests/components/DraftPanel.tsx`

**Step 1: Create `RequestsHeader.tsx`**

```tsx
// app/(dashboard)/requests/components/RequestsHeader.tsx

interface Props {
  userRole: string
  cleaning: boolean
  cleanResult: string | null
  onCleanup: () => void
}

export function RequestsHeader({ userRole, cleaning, cleanResult, onCleanup }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Заявки</h1>
          <p className="text-sm text-white/60 mt-0.5">Поръчки към доставчици</p>
        </div>
        {userRole === 'admin' && (
          <button
            onClick={onCleanup}
            disabled={cleaning}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06] hover:text-white/60 disabled:opacity-30"
          >
            {cleaning ? '🔍 Проверявам...' : cleanResult || '🤖 Провери имена'}
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create `ProductSearch.tsx`**

```tsx
// app/(dashboard)/requests/components/ProductSearch.tsx
import React from 'react'
import { Product, RequestItem } from '../types'

interface Props {
  search: string
  setSearch: (v: string) => void
  suggestions: Product[]
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  searching: boolean
  searchRef: React.RefObject<HTMLInputElement>
  draftItems: RequestItem[]
  filteredTop: Product[]
  availableCategories: string[]
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  onAddProduct: (p: Product | { name: string; unit: string; id?: string }) => void
  onAddCustomProduct: () => void
}

export function ProductSearch({
  search, setSearch, suggestions, showSuggestions, setShowSuggestions,
  searching, searchRef, draftItems, filteredTop, availableCategories,
  selectedCategory, setSelectedCategory, onAddProduct, onAddCustomProduct,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => search.length >= 1 && setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions.length > 0) onAddProduct(suggestions[0])
              else if (e.key === 'Enter' && search.trim()) onAddCustomProduct()
            }}
            placeholder="Търси продукт..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30"
          />
          {searching && (
            <div className="absolute right-3 top-3.5">
              <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f14] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
              {suggestions.map(p => (
                <button key={p.id} onClick={() => onAddProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-[10px] text-white/30">{p.category} · {p.unit}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {p.last_price && <div className="text-xs text-white/50">{p.last_price.toFixed(2)}€</div>}
                    <div className="text-[10px] text-white/25">{p.order_count}× поръчван</div>
                  </div>
                </button>
              ))}
              {search.trim() && !suggestions.some(s => s.name.toLowerCase() === search.toLowerCase()) && (
                <button onClick={onAddCustomProduct}
                  className="w-full flex items-center px-4 py-3 hover:bg-white/5 text-left border-t border-white/[0.06]">
                  <span className="text-xs text-amber-400">+ Добави &quot;{search}&quot; като нов продукт</span>
                </button>
              )}
            </div>
          )}
        </div>
        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}
      </div>

      {/* Top products by category */}
      <div>
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-amber-400/15 text-amber-400' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {filteredTop.slice(0, 25).map(p => {
            const inDraft = draftItems.some(i => i.product_name === p.name)
            return (
              <button key={p.id} onClick={() => onAddProduct(p)}
                className={`text-left px-2.5 py-2 rounded-lg border transition-all ${
                  inDraft ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15'
                }`}>
                <div className="text-[11px] text-white/80 font-medium leading-tight line-clamp-2">{p.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-white/25">{p.order_count}×</span>
                  {inDraft && <span className="text-[9px] text-amber-400">✓</span>}
                </div>
              </button>
            )
          })}
          {filteredTop.length === 0 && (
            <div className="col-span-full text-center py-6 text-white/30 text-xs">Няма продукти</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Create `PastRequests.tsx`**

```tsx
// app/(dashboard)/requests/components/PastRequests.tsx
import { DeliveryRequest, RequestItem } from '../types'

interface Props {
  pastRequests: DeliveryRequest[]
  selectedRequest: string | null
  setSelectedRequest: (id: string | null) => void
  userRole: string
  onAddMultiple: (items: { product_name: string; unit: string; product_id: string | null }[]) => void
  onDelete: (id: string) => void
}

export function PastRequests({
  pastRequests, selectedRequest, setSelectedRequest, userRole, onAddMultiple, onDelete,
}: Props) {
  if (pastRequests.length === 0) return null

  return (
    <div>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-3">Предишни заявки</div>
      <div className="space-y-2">
        {pastRequests.map(r => (
          <div key={r.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div onClick={() => setSelectedRequest(selectedRequest === r.id ? null : r.id)} className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    r.status === 'submitted' ? 'bg-amber-500/15 text-amber-400' :
                    r.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                    r.status === 'delivered' ? 'bg-sky-500/15 text-sky-400' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {r.status === 'submitted' ? 'Изпратена' :
                     r.status === 'approved' ? 'Одобрена' :
                     r.status === 'delivered' ? 'Доставена' : r.status}
                  </span>
                  <span className="text-xs text-white/40">{r.created_by}</span>
                </div>
                <span className="text-xs text-white/30">{new Date(r.created_at).toLocaleDateString('bg-BG')}</span>
              </div>
              <div className="text-xs text-white/50 mt-1">{r.delivery_request_items?.length || 0} продукта</div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onAddMultiple((r.delivery_request_items || []).map(i => ({
                    product_name: i.product_name, unit: i.unit, product_id: i.product_id,
                  })))
                }}
                className="text-[10px] text-amber-400/60 hover:text-amber-400 mt-1">
                📋 Добави всички към заявка
              </button>
            </div>

            {selectedRequest === r.id && (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                {r.ai_suggestions && (
                  <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-2.5 mb-3 text-xs text-amber-400/80">
                    🤖 {r.ai_suggestions}
                  </div>
                )}
                {r.delivery_request_items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0">
                    <span className="text-white/70">{item.product_name}</span>
                    <span className="text-white/40">{item.quantity} {item.unit}</span>
                  </div>
                ))}
                {userRole === 'admin' && (
                  <button onClick={() => onDelete(r.id)} className="mt-2 text-[10px] text-red-400/50 hover:text-red-400">
                    Изтрий
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Create `DraftPanel.tsx`**

```tsx
// app/(dashboard)/requests/components/DraftPanel.tsx
import { RequestItem } from '../types'

interface Props {
  draftItems: RequestItem[]
  draftNotes: string
  setDraftNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  aiSuggestion: string | null
  setAiSuggestion: (v: string | null) => void
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
}

export function DraftPanel({
  draftItems, draftNotes, setDraftNotes,
  saving, submitting, aiSuggestion, setAiSuggestion,
  onUpdateQty, onRemoveItem, onSave, onSubmit,
}: Props) {
  return (
    <div className="sticky top-[80px] bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Текуща заявка</div>
        {draftItems.length > 0 && (
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">{draftItems.length} продукта</span>
        )}
      </div>

      {aiSuggestion && (
        <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-3 mb-4 text-xs text-amber-400/80">
          🤖 {aiSuggestion}
          <button onClick={() => setAiSuggestion(null)} className="text-white/30 ml-2 hover:text-white/50">✕</button>
        </div>
      )}

      {draftItems.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-xs text-white/30">Търси или избери продукти от списъка</div>
        </div>
      ) : (<>
        <div className="space-y-1 mb-4 max-h-[400px] overflow-y-auto">
          {draftItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 group">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/80 truncate">{item.product_name}</div>
                <div className="text-[10px] text-white/25">{item.unit}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onUpdateQty(idx, item.quantity - 1)}
                  className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs">−</button>
                <input
                  type="number" min="0" step="1" value={item.quantity}
                  onChange={e => onUpdateQty(idx, parseFloat(e.target.value) || 0)}
                  className="w-10 bg-transparent text-center text-xs text-white font-medium focus:outline-none"
                />
                <button onClick={() => onUpdateQty(idx, item.quantity + 1)}
                  className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs">+</button>
              </div>
              <button onClick={() => onRemoveItem(idx)}
                className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 text-xs transition-opacity">✕</button>
            </div>
          ))}
        </div>

        <textarea
          value={draftNotes}
          onChange={e => setDraftNotes(e.target.value)}
          placeholder="Бележка за доставчика..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:border-amber-400/30 focus:outline-none resize-none placeholder:text-white/20 mb-3"
        />

        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 disabled:opacity-30">
            {saving ? '...' : '💾 Запази'}
          </button>
          <button onClick={onSubmit} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30">
            {submitting ? (
              <span className="flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                Изпращам...
              </span>
            ) : '📤 Изпрати'}
          </button>
        </div>
      </>)}
    </div>
  )
}
```

**Step 5: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 6: Commit all 4 components**

```bash
git add "app/(dashboard)/requests/components/"
git commit -m "refactor(requests): extract 4 presentational components"
```

---

### Task 4: Rewrite `page.tsx` as composition shell

**Files:**
- Modify: `app/(dashboard)/requests/page.tsx`

**Step 1: Replace the entire file**

```tsx
// app/(dashboard)/requests/page.tsx
'use client'

import { useRequests } from './hooks/useRequests'
import { RequestsHeader } from './components/RequestsHeader'
import { ProductSearch } from './components/ProductSearch'
import { PastRequests } from './components/PastRequests'
import { DraftPanel } from './components/DraftPanel'

export default function RequestsPage() {
  const r = useRequests()

  return (
    <div className="min-h-screen">
      <RequestsHeader
        userRole={r.userRole}
        cleaning={r.cleaning}
        cleanResult={r.cleanResult}
        onCleanup={r.handleCleanup}
      />

      <div className="p-6">
        {r.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ProductSearch
                search={r.search}
                setSearch={r.setSearch}
                suggestions={r.suggestions}
                showSuggestions={r.showSuggestions}
                setShowSuggestions={r.setShowSuggestions}
                searching={r.searching}
                searchRef={r.searchRef}
                draftItems={r.draftItems}
                filteredTop={r.filteredTop}
                availableCategories={r.availableCategories}
                selectedCategory={r.selectedCategory}
                setSelectedCategory={r.setSelectedCategory}
                onAddProduct={r.addProduct}
                onAddCustomProduct={r.addCustomProduct}
              />
              <PastRequests
                pastRequests={r.pastRequests}
                selectedRequest={r.selectedRequest}
                setSelectedRequest={r.setSelectedRequest}
                userRole={r.userRole}
                onAddMultiple={r.addMultipleProducts}
                onDelete={r.handleDelete}
              />
            </div>
            <div className="lg:col-span-1">
              <DraftPanel
                draftItems={r.draftItems}
                draftNotes={r.draftNotes}
                setDraftNotes={r.setDraftNotes}
                saving={r.saving}
                submitting={r.submitting}
                aiSuggestion={r.aiSuggestion}
                setAiSuggestion={r.setAiSuggestion}
                onUpdateQty={r.updateQty}
                onRemoveItem={r.removeItem}
                onSave={r.handleSave}
                onSubmit={r.handleSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript**

Run: `cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 3: Commit**

```bash
git add "app/(dashboard)/requests/page.tsx"
git commit -m "refactor(requests): rewrite page as 60-line composition shell"
```

---

## Final Result

```
app/(dashboard)/requests/
├── page.tsx              ~60 lines  (was 442)
├── types.ts              ~25 lines
├── hooks/
│   └── useRequests.ts   ~160 lines
└── components/
    ├── RequestsHeader.tsx   ~25 lines
    ├── ProductSearch.tsx    ~85 lines
    ├── PastRequests.tsx     ~65 lines
    └── DraftPanel.tsx       ~75 lines
```

Total: ~495 lines split across 7 files. Zero behavior change.
