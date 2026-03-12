# ЗАЯВКИ Module Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full rebuild of the ЗАЯВКИ (Delivery Requests) module — two-view page structure (История / Нова заявка), product picker with search + category + supplier tabs, AI suggestions on submit, admin approve/reject/clean_names.

**Architecture:** Replace all existing files in `app/(dashboard)/requests/` and `app/api/requests/route.ts`. New structure splits into focused components (ProductCard, ProductPicker, DraftPanel, HistoryView, etc.) connected via a single `useRequests` hook. API fully rewritten with explicit GET type params and POST actions.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase (`mcp__supabase__*`), Anthropic API (claude-haiku-4-5-20251001)

**Spec:** `docs/superpowers/specs/2026-03-12-requests-module-redesign.md`

---

## Chunk 1: Types + API Route

### Task 1: Types

**Files:**
- Overwrite: `app/(dashboard)/requests/types.ts`

- [ ] **Step 1: Replace types.ts with complete type definitions**

```typescript
// app/(dashboard)/requests/types.ts

export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface DeliveryProduct {
  id: string
  name: string
  clean_name: string | null
  category: string
  unit: string
  last_price: number | null
  order_count: number
}

export interface SupplierProduct {
  product_name: string
  unit: string
  clean_name: string | null  // matched from delivery_products
}

export interface DraftItem {
  product_id: string | null
  product_name: string        // resolved: clean_name ?? name at add-time
  quantity: number            // integer, min 1
  unit: string
  note: string | null
}

export interface SavedDraftItem extends DraftItem {
  id: string
}

export interface DeliveryRequest {
  id: string
  month: string               // YYYY-MM
  status: RequestStatus
  created_by: string
  approved_by: string | null
  notes: string | null
  ai_suggestions: string | null
  created_at: string
  delivery_request_items: SavedDraftItem[]
}

export interface Supplier {
  supplier_name: string
  product_count: number
}

export interface AISuggestion {
  prose: string
  suggestions: { name: string; unit: string }[]
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `requests/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/types.ts
git commit -m "feat(requests): define full TypeScript types for module rebuild"
```

---

### Task 2: API — GET endpoints

**Files:**
- Overwrite: `app/api/requests/route.ts` (GET handler only, POST to follow)

- [ ] **Step 1: Write the GET handler**

```typescript
// app/api/requests/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    // Autocomplete search — searches name AND clean_name
    if (type === 'search') {
      const q = searchParams.get('q') || ''
      if (q.length < 2) return NextResponse.json({ products: [] })
      const { data } = await supabase
        .from('delivery_products')
        .select('id, name, clean_name, category, unit, last_price, order_count')
        .eq('gym_id', GYM_ID)
        .or(`name.ilike.%${q}%,clean_name.ilike.%${q}%`)
        .order('order_count', { ascending: false })
        .limit(10)
      return NextResponse.json({ products: data || [] })
    }

    // Top products by order_count (categories derived client-side)
    if (type === 'top') {
      const { data } = await supabase
        .from('delivery_products')
        .select('id, name, clean_name, category, unit, last_price, order_count')
        .eq('gym_id', GYM_ID)
        .order('order_count', { ascending: false })
        .limit(100)
      return NextResponse.json({ products: data || [] })
    }

    // Suppliers with delivery history — two-step: deliveries → items count
    if (type === 'suppliers') {
      const { data: allDeliveries } = await supabase
        .from('deliveries')
        .select('id, supplier_name')
        .eq('gym_id', GYM_ID)
        .not('supplier_name', 'is', null)

      if (!allDeliveries || allDeliveries.length === 0) {
        return NextResponse.json({ suppliers: [] })
      }

      const deliveryIds = allDeliveries.map(d => d.id)
      const { data: allItems } = await supabase
        .from('delivery_items')
        .select('delivery_id, product_name')
        .in('delivery_id', deliveryIds)

      // Count distinct products per supplier
      const supplierProductSets: Record<string, Set<string>> = {}
      for (const d of allDeliveries) {
        if (!supplierProductSets[d.supplier_name]) {
          supplierProductSets[d.supplier_name] = new Set()
        }
      }
      const deliverySupplierMap: Record<string, string> = {}
      for (const d of allDeliveries) deliverySupplierMap[d.id] = d.supplier_name

      for (const item of allItems || []) {
        const supplier = deliverySupplierMap[item.delivery_id]
        if (supplier) supplierProductSets[supplier].add(item.product_name)
      }

      const suppliers = Object.entries(supplierProductSets)
        .map(([supplier_name, products]) => ({ supplier_name, product_count: products.size }))
        .sort((a, b) => b.product_count - a.product_count)

      return NextResponse.json({ suppliers })
    }

    // Products by supplier — two-step: delivery IDs → distinct product_names
    if (type === 'supplier') {
      const supplierName = searchParams.get('name')
      if (!supplierName) return NextResponse.json({ products: [] })

      const { data: supplierDeliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq('gym_id', GYM_ID)
        .eq('supplier_name', supplierName)

      const ids = (supplierDeliveries || []).map(d => d.id)
      if (ids.length === 0) return NextResponse.json({ products: [] })

      const { data: items } = await supabase
        .from('delivery_items')
        .select('product_name, unit')
        .in('delivery_id', ids)

      // Deduplicate by product_name
      const seen = new Set<string>()
      const uniqueItems: { product_name: string; unit: string }[] = []
      for (const item of items || []) {
        if (!seen.has(item.product_name)) {
          seen.add(item.product_name)
          uniqueItems.push({ product_name: item.product_name, unit: item.unit })
        }
      }

      // Match with delivery_products for clean_name
      const productNames = uniqueItems.map(i => i.product_name)
      const { data: catalog } = await supabase
        .from('delivery_products')
        .select('name, clean_name')
        .eq('gym_id', GYM_ID)
        .in('name', productNames)

      const cleanMap: Record<string, string | null> = {}
      for (const p of catalog || []) cleanMap[p.name] = p.clean_name

      const products = uniqueItems.map(i => ({
        product_name: i.product_name,
        unit: i.unit,
        clean_name: cleanMap[i.product_name] ?? null,
      }))

      return NextResponse.json({ products })
    }

    // Default: list all requests + active draft for current month
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, delivery_request_items(*)')
      .eq('gym_id', GYM_ID)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ requests: data || [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 })
}
```

- [ ] **Step 2: Check the Supabase JOIN syntax compiles (TypeScript)**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep -i requests
```

Expected: no errors in `app/api/requests/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/requests/route.ts
git commit -m "feat(requests): rewrite API GET endpoints (search, top, suppliers, supplier, list)"
```

---

### Task 3: API — POST actions

**Files:**
- Modify: `app/api/requests/route.ts` (replace stub POST with full implementation)

- [ ] **Step 1: Replace the POST stub with full implementation**

Replace the `export async function POST` function entirely:

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body as { action: string } & Record<string, unknown>

    // ── create_draft ─────────────────────────────────────────────────────────
    if (action === 'create_draft') {
      const { created_by } = body as { created_by: string }
      const month = new Date().toISOString().slice(0, 7)

      // Guard: check if draft already exists for this month
      const { data: existing } = await supabase
        .from('delivery_requests')
        .select('id')
        .eq('gym_id', GYM_ID)
        .eq('month', month)
        .eq('status', 'draft')
        .maybeSingle()

      if (existing) return NextResponse.json({ request: existing })

      const { data: request, error } = await supabase
        .from('delivery_requests')
        .insert([{ gym_id: GYM_ID, month, status: 'draft', created_by }])
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ request })
    }

    // ── save_draft ────────────────────────────────────────────────────────────
    if (action === 'save_draft') {
      const { id, notes, items } = body as {
        id: string
        notes: string | null
        items: Array<{ product_id: string | null; product_name: string; quantity: number; unit: string; note: string | null }>
      }
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

      await supabase
        .from('delivery_requests')
        .update({ notes: notes ?? null, updated_at: new Date().toISOString() })
        .eq('id', id)

      // delete + re-insert is safe here (draft only)
      await supabase.from('delivery_request_items').delete().eq('request_id', id)

      if (items && items.length > 0) {
        await supabase.from('delivery_request_items').insert(
          items.map(i => ({
            request_id: id,
            product_id: i.product_id ?? null,
            product_name: i.product_name,
            quantity: i.quantity,
            unit: i.unit,
            note: i.note ?? null,
          }))
        )
      }

      return NextResponse.json({ success: true })
    }

    // ── submit ────────────────────────────────────────────────────────────────
    // Two-phase:
    //   force=false (default): run AI check; if suggestions exist → save ai_suggestions
    //     but DO NOT change status; return { pending: true, suggested_products, ai_suggestions }
    //   force=true: skip AI, change status to 'submitted' immediately
    if (action === 'submit') {
      const { id, force = false } = body as { id: string; force?: boolean }
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

      const { data: request } = await supabase
        .from('delivery_requests')
        .select('*, delivery_request_items(product_name, unit)')
        .eq('id', id)
        .single()

      const items = request?.delivery_request_items ?? []
      if (items.length === 0) {
        return NextResponse.json({ error: 'Заявката е празна' }, { status: 400 })
      }

      // force=true → skip AI, just submit
      if (force) {
        await supabase
          .from('delivery_requests')
          .update({ status: 'submitted', updated_at: new Date().toISOString() })
          .eq('id', id)
        return NextResponse.json({ success: true, pending: false })
      }

      // Run AI check
      let aiResult: { prose: string; suggestions: { name: string; unit: string }[] } = {
        prose: '',
        suggestions: [],
      }

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        try {
          const { data: topProducts } = await supabase
            .from('delivery_products')
            .select('name, clean_name, category, order_count')
            .eq('gym_id', GYM_ID)
            .gt('order_count', 1)
            .order('order_count', { ascending: false })
            .limit(40)

          const productNames = items.map((i: { product_name: string }) => i.product_name).join(', ')
          const topList = (topProducts || [])
            .map(p => `${p.clean_name ?? p.name} (${p.category}, ${p.order_count}×)`)
            .join(', ')

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 600,
              messages: [{
                role: 'user',
                content: `Ти си асистент за фитнес зала. Проверяваш заявка за доставка.
Текуща заявка: ${productNames}
Най-поръчвани продукти: ${topList}

Ако забележиш обичайни продукти, които липсват, предложи ги.
Върни САМО JSON (без markdown): { "prose": "...", "suggestions": [{"name": "...", "unit": "..."}] }
Ако всичко изглежда пълно, върни: { "prose": "Заявката изглежда пълна.", "suggestions": [] }`,
              }],
            }),
          })

          const aiData = await response.json()
          const text = (aiData.content?.[0]?.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          try {
            aiResult = JSON.parse(text)
          } catch {
            aiResult = { prose: text, suggestions: [] }
          }
        } catch (e) {
          console.error('[requests submit AI error]', e)
        }
      }

      // If AI found suggestions → save prose but keep status as 'draft', return pending
      if (aiResult.suggestions.length > 0) {
        await supabase
          .from('delivery_requests')
          .update({ ai_suggestions: aiResult.prose, updated_at: new Date().toISOString() })
          .eq('id', id)
        return NextResponse.json({
          pending: true,
          ai_suggestions: aiResult.prose,
          suggested_products: aiResult.suggestions,
        })
      }

      // No suggestions → submit immediately
      await supabase
        .from('delivery_requests')
        .update({
          status: 'submitted',
          ai_suggestions: aiResult.prose || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({ success: true, pending: false })
    }

    // ── approve ───────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const { id, approved_by } = body as { id: string; approved_by: string }
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      await supabase
        .from('delivery_requests')
        .update({ status: 'approved', approved_by, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    // ── reject ────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const { id } = body as { id: string }
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      await supabase
        .from('delivery_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    // ── clean_names ───────────────────────────────────────────────────────────
    if (action === 'clean_names') {
      const { data: products } = await supabase
        .from('delivery_products')
        .select('id, name, category')
        .eq('gym_id', GYM_ID)
        .is('clean_name', null)

      if (!products || products.length === 0) {
        return NextResponse.json({ success: true, cleaned: 0 })
      }

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 })

      const BATCH_SIZE = 20
      let cleaned = 0

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE)
        const names = batch.map(p => p.name)

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2000,
              system: 'You are a product name cleaner for a Bulgarian gym shop. Given raw supplier invoice product names, return clean short Bulgarian-friendly display names. Remove: supplier codes, long dimensions/weights if obvious, dates, model numbers unless they distinguish the product. Keep: brand, product type, key variant (flavor/size if important). Return ONLY a JSON array of objects: [{"original": "...", "clean": "..."}]. No markdown, no explanation.',
              messages: [{ role: 'user', content: JSON.stringify(names) }],
            }),
          })

          const data = await response.json()
          const text = (data.content?.[0]?.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const corrections: { original: string; clean: string }[] = JSON.parse(text)

          const nameToClean: Record<string, string> = {}
          for (const c of corrections) nameToClean[c.original] = c.clean

          await Promise.all(
            batch.map(p => {
              const clean = nameToClean[p.name]
              if (!clean) return Promise.resolve()
              cleaned++
              return supabase
                .from('delivery_products')
                .update({ clean_name: clean })
                .eq('id', p.id)
            })
          )
        } catch (e) {
          console.error('[clean_names batch error]', e)
        }
      }

      return NextResponse.json({ success: true, cleaned })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[requests POST error]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep -i requests
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/requests/route.ts
git commit -m "feat(requests): rewrite API POST actions (create_draft, save_draft, submit, approve, reject, clean_names)"
```

---

## Chunk 2: Shared Components + History UI

### Task 4: ConfirmModal

**Files:**
- Create: `app/(dashboard)/requests/components/ConfirmModal.tsx`

- [ ] **Step 1: Create the reusable confirm modal**

```tsx
// app/(dashboard)/requests/components/ConfirmModal.tsx

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Потвърди',
  cancelLabel = 'Отказ',
  danger = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-white/50 border border-white/10 hover:text-white/70 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              danger
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep ConfirmModal
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/ConfirmModal.tsx
git commit -m "feat(requests): add reusable ConfirmModal component"
```

---

### Task 5: RequestsHeader (История view header)

**Files:**
- Overwrite: `app/(dashboard)/requests/components/RequestsHeader.tsx`

- [ ] **Step 1: Rewrite RequestsHeader**

```tsx
// app/(dashboard)/requests/components/RequestsHeader.tsx

interface Props {
  userRole: string
  statusFilter: string
  onStatusFilter: (s: string) => void
  onNewRequest: () => void
  cleaning: boolean
  cleanResult: string | null
  onCleanNames: () => void
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Всички' },
  { value: 'draft', label: 'Чернова' },
  { value: 'submitted', label: 'Изпратена' },
  { value: 'approved', label: 'Одобрена' },
  { value: 'rejected', label: 'Отхвърлена' },
]

export function RequestsHeader({
  userRole, statusFilter, onStatusFilter,
  onNewRequest, cleaning, cleanResult, onCleanNames,
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Заявки за доставки</h1>
          <p className="text-sm text-white/50 mt-0.5">Поръчки към доставчици</p>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'admin' && (
            <button
              onClick={onCleanNames}
              disabled={cleaning}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06] hover:text-white/60 disabled:opacity-30 transition-colors"
            >
              {cleaning ? '⏳ Обработвам...' : cleanResult ?? '🤖 Генерирай чисти имена'}
            </button>
          )}
          <button
            onClick={onNewRequest}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 transition-opacity"
          >
            + Нова заявка
          </button>
        </div>
      </div>

      {userRole === 'admin' && (
        <div className="flex items-center gap-1.5 mt-3">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'bg-white/5 text-white/40 hover:text-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep RequestsHeader
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/RequestsHeader.tsx
git commit -m "feat(requests): rewrite RequestsHeader with status filter + clean names button"
```

---

### Task 6: RequestModal (read-only past request)

**Files:**
- Create: `app/(dashboard)/requests/components/RequestModal.tsx`

- [ ] **Step 1: Create RequestModal**

```tsx
// app/(dashboard)/requests/components/RequestModal.tsx
import { DeliveryRequest, RequestStatus } from '../types'

interface Props {
  request: DeliveryRequest | null
  onClose: () => void
  onAddAllToNew: (request: DeliveryRequest) => void
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Чернова',
  submitted: 'Изпратена',
  approved: 'Одобрена',
  rejected: 'Отхвърлена',
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'bg-white/10 text-white/50',
  submitted: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  const months = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']
  return `${months[parseInt(m) - 1]} ${year}`
}

export function RequestModal({ request, onClose, onAddAllToNew }: Props) {
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">{formatMonth(request.month)}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {request.created_by} · {request.delivery_request_items.length} продукта
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg">✕</button>
        </div>

        {/* AI suggestions */}
        {request.ai_suggestions && (
          <div className="mx-6 mt-4 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-3 text-xs text-amber-400/80">
            🤖 {request.ai_suggestions}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {request.delivery_request_items.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
              <span className="text-sm text-white/80">{item.product_name}</span>
              <span className="text-sm text-white/40 shrink-0 ml-4">{item.quantity} {item.unit}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="mx-6 mb-4 bg-white/[0.02] rounded-lg px-3 py-2 text-xs text-white/50">
            {request.notes}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => onAddAllToNew(request)}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
          >
            📋 Добави всичко към нова заявка
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep RequestModal
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/RequestModal.tsx
git commit -m "feat(requests): add RequestModal read-only view with add-all-to-new action"
```

---

### Task 7: HistoryView

**Files:**
- Create: `app/(dashboard)/requests/components/HistoryView.tsx`
- Delete: `app/(dashboard)/requests/components/PastRequests.tsx` (replaced)

- [ ] **Step 1: Create HistoryView**

```tsx
// app/(dashboard)/requests/components/HistoryView.tsx
'use client'

import { DeliveryRequest, RequestStatus } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { RequestModal } from './RequestModal'
import { useState } from 'react'

interface Props {
  requests: DeliveryRequest[]
  statusFilter: string
  userRole: string
  onAddAllToNew: (request: DeliveryRequest) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Чернова',
  submitted: 'Изпратена',
  approved: 'Одобрена',
  rejected: 'Отхвърлена',
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'bg-white/10 text-white/50',
  submitted: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return `${MONTHS_BG[parseInt(m) - 1]} ${year}`
}

export function HistoryView({ requests, statusFilter, userRole, onAddAllToNew, onApprove, onReject }: Props) {
  const [viewRequest, setViewRequest] = useState<DeliveryRequest | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null)

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter)

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-white/40 text-sm">Няма заявки</div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{formatMonth(r.month)}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {r.created_by} · {r.delivery_request_items.length} продукта
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {userRole === 'admin' && r.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => setConfirmAction({ type: 'approve', id: r.id })}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
                    >
                      Одобри
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'reject', id: r.id })}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
                    >
                      Отхвърли
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewRequest(r)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/10 hover:text-white/70 transition-colors"
                >
                  Преглед
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <RequestModal
        request={viewRequest}
        onClose={() => setViewRequest(null)}
        onAddAllToNew={(req) => { setViewRequest(null); onAddAllToNew(req) }}
      />

      <ConfirmModal
        open={confirmAction?.type === 'approve'}
        title="Одобри заявка"
        message="Сигурен ли си, че искаш да одобриш тази заявка?"
        confirmLabel="Одобри"
        onConfirm={() => { if (confirmAction) { onApprove(confirmAction.id); setConfirmAction(null) } }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmModal
        open={confirmAction?.type === 'reject'}
        title="Отхвърли заявка"
        message="Сигурен ли си, че искаш да отхвърлиш тази заявка?"
        confirmLabel="Отхвърли"
        danger
        onConfirm={() => { if (confirmAction) { onReject(confirmAction.id); setConfirmAction(null) } }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  )
}
```

- [ ] **Step 2: Delete old PastRequests.tsx**

```bash
rm app/\(dashboard\)/requests/components/PastRequests.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep -i "requests"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/requests/components/HistoryView.tsx
git rm app/\(dashboard\)/requests/components/PastRequests.tsx
git commit -m "feat(requests): add HistoryView with approve/reject/preview, remove PastRequests"
```

---

## Chunk 3: New Request UI

### Task 8: ProductCard

**Files:**
- Create: `app/(dashboard)/requests/components/ProductCard.tsx`

- [ ] **Step 1: Create ProductCard**

```tsx
// app/(dashboard)/requests/components/ProductCard.tsx

interface Props {
  name: string          // already resolved: clean_name ?? name
  orderCount?: number
  inDraft: boolean
  onClick: () => void
}

export function ProductCard({ name, orderCount, inDraft, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-2.5 py-2.5 rounded-lg border transition-all w-full ${
        inDraft
          ? 'bg-amber-500/10 border-amber-500/25'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]'
      }`}
    >
      <div className="text-[11px] text-white/85 font-medium leading-tight line-clamp-2 mb-1.5">
        {name}
      </div>
      <div className="flex items-center justify-between">
        {orderCount !== undefined && (
          <span className="text-[9px] text-white/25">{orderCount}×</span>
        )}
        {inDraft && <span className="text-[9px] text-amber-400 ml-auto">✓</span>}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep ProductCard
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/ProductCard.tsx
git commit -m "feat(requests): add ProductCard component"
```

---

### Task 9: ProductPicker

**Files:**
- Create: `app/(dashboard)/requests/components/ProductPicker.tsx`
- Delete: `app/(dashboard)/requests/components/ProductSearch.tsx` (replaced by ProductPicker)

- [ ] **Step 1: Create ProductPicker**

```tsx
// app/(dashboard)/requests/components/ProductPicker.tsx
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { DeliveryProduct, DraftItem, Supplier, SupplierProduct } from '../types'
import { ProductCard } from './ProductCard'

interface Props {
  topProducts: DeliveryProduct[]
  draftItems: DraftItem[]
  onAddProduct: (name: string, unit: string, productId: string | null) => void
}

type TabType = 'category' | 'supplier'

export function ProductPicker({ topProducts, draftItems, onAddProduct }: Props) {
  const [tab, setTab] = useState<TabType>('category')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<DeliveryProduct[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [loadingSupplier, setLoadingSupplier] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Derive categories from topProducts client-side
  const categories = ['all', ...new Set(topProducts.map(p => p.category).filter(Boolean))]

  const filteredProducts = selectedCategory === 'all'
    ? topProducts
    : topProducts.filter(p => p.category === selectedCategory)

  const isDraftItem = useCallback((name: string) =>
    draftItems.some(i => i.product_name === name), [draftItems])

  // Load suppliers once
  useEffect(() => {
    fetch('/api/requests?type=suppliers')
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  // Load supplier products on selection
  useEffect(() => {
    if (!selectedSupplier) { setSupplierProducts([]); return }
    setLoadingSupplier(true)
    fetch(`/api/requests?type=supplier&name=${encodeURIComponent(selectedSupplier)}`)
      .then(r => r.json())
      .then(d => setSupplierProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoadingSupplier(false))
  }, [selectedSupplier])

  // Autocomplete search with debounce
  useEffect(() => {
    if (search.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/requests?type=search&q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSuggestions(data.products || [])
        setShowSuggestions(true)
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [search])

  const handleAddFromSuggestion = (p: DeliveryProduct) => {
    onAddProduct(p.clean_name ?? p.name, p.unit, p.id)
    setSearch('')
    setSuggestions([])
    setShowSuggestions(false)
    searchRef.current?.focus()
  }

  const handleAddManual = () => {
    if (!manualInput.trim()) return
    onAddProduct(manualInput.trim(), 'бр', null)
    setManualInput('')
    setShowManual(false)
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setShowSuggestions(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && suggestions.length > 0) handleAddFromSuggestion(suggestions[0])
            else if (e.key === 'Escape') { setShowSuggestions(false); setSearch('') }
          }}
          placeholder="Търси продукт... (мин. 2 букви)"
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
          </div>
        )}

        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
        <button
          onClick={() => setTab('category')}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'category' ? 'bg-[#0f0f14] text-white border border-white/10' : 'text-white/40 hover:text-white/60'
          }`}
        >
          📦 По категория
        </button>
        <button
          onClick={() => setTab('supplier')}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'supplier' ? 'bg-[#0f0f14] text-white border border-white/10' : 'text-white/40 hover:text-white/60'
          }`}
        >
          🏪 По доставчик
        </button>
      </div>

      {/* Category tab */}
      {tab === 'category' && (
        <div>
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-400/15 text-amber-400'
                    : 'bg-white/5 text-white/40 hover:text-white/60'
                }`}
              >
                {cat === 'all' ? '⭐ Всички' : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {filteredProducts.slice(0, 32).map(p => {
              const displayName = p.clean_name ?? p.name
              return (
                <ProductCard
                  key={p.id}
                  name={displayName}
                  orderCount={p.order_count}
                  inDraft={isDraftItem(displayName)}
                  onClick={() => onAddProduct(displayName, p.unit, p.id)}
                />
              )
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/30 text-xs">Няма продукти</div>
            )}
          </div>
        </div>
      )}

      {/* Supplier tab */}
      {tab === 'supplier' && (
        <div>
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400/50 focus:outline-none mb-4 appearance-none"
          >
            <option value="">Избери доставчик...</option>
            {suppliers.map(s => (
              <option key={s.supplier_name} value={s.supplier_name}>
                {s.supplier_name} ({s.product_count} продукта)
              </option>
            ))}
          </select>

          {loadingSupplier && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}

          {!loadingSupplier && selectedSupplier && supplierProducts.length === 0 && (
            <div className="text-center py-8 text-white/30 text-xs">Няма данни за този доставчик</div>
          )}

          {!loadingSupplier && supplierProducts.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {supplierProducts.map((p, i) => {
                const displayName = p.clean_name ?? p.product_name
                return (
                  <ProductCard
                    key={i}
                    name={displayName}
                    inDraft={isDraftItem(displayName)}
                    onClick={() => onAddProduct(displayName, p.unit, null)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual add */}
      <div className="border-t border-white/[0.05] pt-3">
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-amber-400/50 hover:text-amber-400 transition-colors"
          >
            + Добави продукт ръчно
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              autoFocus
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); if (e.key === 'Escape') setShowManual(false) }}
              placeholder="Име на продукт..."
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30"
            />
            <button
              onClick={handleAddManual}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
            >
              Добави
            </button>
            <button
              onClick={() => { setShowManual(false); setManualInput('') }}
              className="px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete old ProductSearch.tsx**

```bash
rm app/\(dashboard\)/requests/components/ProductSearch.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep -i product
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/requests/components/ProductPicker.tsx app/\(dashboard\)/requests/components/ProductCard.tsx
git rm app/\(dashboard\)/requests/components/ProductSearch.tsx
git commit -m "feat(requests): add ProductPicker with search + category + supplier tabs"
```

---

### Task 10: DraftPanel

**Files:**
- Overwrite: `app/(dashboard)/requests/components/DraftPanel.tsx`

- [ ] **Step 1: Rewrite DraftPanel**

```tsx
// app/(dashboard)/requests/components/DraftPanel.tsx
import { DraftItem } from '../types'

interface Props {
  items: DraftItem[]
  notes: string
  setNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
}

export function DraftPanel({
  items, notes, setNotes,
  saving, submitting,
  onUpdateQty, onRemoveItem, onSave, onSubmit,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-white/[0.02] border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <span className="text-sm font-semibold text-white">Чернова</span>
        {items.length > 0 && (
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">
            {items.length} продукта
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-xs text-white/30">Избери продукти от списъка вляво</div>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="flex-1 overflow-y-auto space-y-1 mb-4 min-h-0">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 group">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/80 truncate">{item.product_name}</div>
                  <div className="text-[10px] text-white/25">{item.unit}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdateQty(idx, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={e => onUpdateQty(idx, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-10 bg-transparent text-center text-xs text-white font-medium focus:outline-none"
                  />
                  <button
                    onClick={() => onUpdateQty(idx, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(idx)}
                  className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 text-xs transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Бележка за доставчика..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:border-amber-400/30 focus:outline-none resize-none placeholder:text-white/20 mb-3 shrink-0"
          />

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              {saving ? '...' : '💾 Запази'}
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-1">
                  <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  Изпращам...
                </span>
              ) : '🚀 Изпрати'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep DraftPanel
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/DraftPanel.tsx
git commit -m "feat(requests): rewrite DraftPanel with integer qty, proper flex layout"
```

---

### Task 11: AISuggestionsModal

**Files:**
- Create: `app/(dashboard)/requests/components/AISuggestionsModal.tsx`

- [ ] **Step 1: Create AISuggestionsModal**

```tsx
// app/(dashboard)/requests/components/AISuggestionsModal.tsx

interface SuggestedProduct {
  name: string
  unit: string
}

interface Props {
  open: boolean
  prose: string
  suggestions: SuggestedProduct[]
  onAddAndSubmit: (products: SuggestedProduct[]) => void
  onSubmitWithout: () => void
  onDismiss: () => void
}

export function AISuggestionsModal({ open, prose, suggestions, onAddAndSubmit, onSubmitWithout, onDismiss }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-sm font-semibold text-white">AI предложения</h3>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-amber-400/80 mb-4">{prose}</p>

          {suggestions.length > 0 && (
            <div className="space-y-2 mb-4">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-[10px] text-amber-400/60">+</span>
                  <span className="text-xs text-white/80 flex-1">{s.name}</span>
                  <span className="text-[10px] text-white/30">{s.unit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {suggestions.length > 0 && (
              <button
                onClick={() => onAddAndSubmit(suggestions)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 transition-opacity"
              >
                Добави всички и изпрати
              </button>
            )}
            <button
              onClick={onSubmitWithout}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
            >
              Изпрати без промяна
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep AISuggestions
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/AISuggestionsModal.tsx
git commit -m "feat(requests): add AISuggestionsModal for post-submit AI check"
```

---

### Task 12: NewRequestView

**Files:**
- Create: `app/(dashboard)/requests/components/NewRequestView.tsx`

- [ ] **Step 1: Create NewRequestView**

```tsx
// app/(dashboard)/requests/components/NewRequestView.tsx
import { DeliveryProduct, DraftItem } from '../types'
import { ProductPicker } from './ProductPicker'
import { DraftPanel } from './DraftPanel'

interface Props {
  month: string              // YYYY-MM
  userRole: string
  topProducts: DeliveryProduct[]
  draftItems: DraftItem[]
  draftNotes: string
  setDraftNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  onAddProduct: (name: string, unit: string, productId: string | null) => void
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
  onBack: () => void
  onShowHistory: () => void   // admin only
}

const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return `${MONTHS_BG[parseInt(m) - 1]} ${year}`
}

export function NewRequestView({
  month, userRole, topProducts, draftItems, draftNotes, setDraftNotes,
  saving, submitting,
  onAddProduct, onUpdateQty, onRemoveItem, onSave, onSubmit, onBack, onShowHistory,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <button onClick={onBack} className="text-sm text-white/40 hover:text-white/70 transition-colors shrink-0">
            ← Назад
          </button>
          <h1 className="text-base font-bold text-white truncate">
            Нова заявка — {formatMonth(month)}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {userRole === 'admin' && (
              <button
                onClick={onShowHistory}
                className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:text-white/60 transition-colors"
              >
                История →
              </button>
            )}
            <button
              onClick={onSubmit}
              disabled={submitting || draftItems.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? '...' : '🚀 Изпрати заявката'}
            </button>
          </div>
        </div>
      </div>

      {/* Content — 60/40 split */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Product picker — 60% */}
        <div className="lg:w-[60%] p-6 lg:border-r border-white/[0.06]">
          <ProductPicker
            topProducts={topProducts}
            draftItems={draftItems}
            onAddProduct={onAddProduct}
          />
        </div>

        {/* Draft panel — 40% */}
        <div className="lg:w-[40%] p-6 lg:sticky lg:top-[73px] lg:self-start lg:max-h-[calc(100vh-73px)] lg:overflow-hidden flex flex-col">
          <DraftPanel
            items={draftItems}
            notes={draftNotes}
            setNotes={setDraftNotes}
            saving={saving}
            submitting={submitting}
            onUpdateQty={onUpdateQty}
            onRemoveItem={onRemoveItem}
            onSave={onSave}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep NewRequestView
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/components/NewRequestView.tsx
git commit -m "feat(requests): add NewRequestView with 60/40 split layout"
```

---

## Chunk 4: Hook + Page

### Task 13: useRequests hook

**Files:**
- Overwrite: `app/(dashboard)/requests/hooks/useRequests.ts`

- [ ] **Step 1: Rewrite useRequests**

```typescript
// app/(dashboard)/requests/hooks/useRequests.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { DeliveryProduct, DraftItem, DeliveryRequest, AISuggestion } from '../types'

export type ViewMode = 'history' | 'new-request'

export function useRequests() {
  const { userRole, userName } = useSession()

  // Data
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [topProducts, setTopProducts] = useState<DeliveryProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Draft state
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftMonth, setDraftMonth] = useState(new Date().toISOString().slice(0, 7))
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // View
  const [view, setView] = useState<ViewMode>('history')
  const [statusFilter, setStatusFilter] = useState('all')

  // AI suggestions modal
  const [aiModal, setAiModal] = useState<AISuggestion | null>(null)
  const [pendingSubmitId, setPendingSubmitId] = useState<string | null>(null)

  // Admin: clean names
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, topRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/requests?type=top'),
      ])
      const [reqData, topData] = await Promise.all([reqRes.json(), topRes.json()])

      const allRequests: DeliveryRequest[] = reqData.requests || []
      setRequests(allRequests)
      setTopProducts(topData.products || [])

      // Restore existing draft if any
      const draft = allRequests.find(r => r.status === 'draft')
      if (draft) {
        setDraftId(draft.id)
        setDraftMonth(draft.month)
        setDraftItems(draft.delivery_request_items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          note: i.note,
        })))
        setDraftNotes(draft.notes ?? '')
      } else {
        setDraftId(null)
        setDraftItems([])
        setDraftNotes('')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Draft mutations ─────────────────────────────────────────────────────────

  const addProduct = useCallback((name: string, unit: string, productId: string | null) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.product_name === name)
      if (existing) {
        return prev.map(i => i.product_name === name ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product_id: productId, product_name: name, quantity: 1, unit, note: null }]
    })
  }, [])

  const addMultipleProducts = useCallback((items: DraftItem[]) => {
    setDraftItems(prev => {
      let updated = [...prev]
      for (const item of items) {
        const existing = updated.find(i => i.product_name === item.product_name)
        if (existing) {
          updated = updated.map(i =>
            i.product_name === item.product_name ? { ...i, quantity: i.quantity + 1 } : i
          )
        } else {
          updated.push({ ...item, quantity: 1 })
        }
      }
      return updated
    })
  }, [])

  const updateQty = useCallback((idx: number, qty: number) => {
    if (qty <= 0) {
      setDraftItems(prev => prev.filter((_, i) => i !== idx))
    } else {
      setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
    }
  }, [])

  const removeItem = useCallback((idx: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── API calls ───────────────────────────────────────────────────────────────

  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (draftId) return draftId
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_draft', created_by: userName }),
    })
    const data = await res.json()
    const id = data.request?.id ?? null
    if (id) setDraftId(id)
    return id
  }, [draftId, userName])

  const handleNewRequest = useCallback(async () => {
    setView('new-request')
    if (!draftId) {
      const id = await ensureDraft()
      if (id) setDraftId(id)
    }
  }, [draftId, ensureDraft])

  const handleSave = useCallback(async () => {
    if (draftItems.length === 0) return
    setSaving(true)
    try {
      const id = await ensureDraft()
      if (!id) return
      await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', id, notes: draftNotes, items: draftItems }),
      })
    } finally {
      setSaving(false)
    }
  }, [draftItems, draftNotes, ensureDraft])

  const handleSubmit = useCallback(async () => {
    if (draftItems.length === 0) return
    setSubmitting(true)
    try {
      await handleSave()
      const id = draftId
      if (!id) return

      // Phase 1: AI check (force=false). Server keeps status as 'draft' if suggestions exist.
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id, force: false }),
      })
      const data = await res.json()

      if (data.pending && data.suggested_products?.length > 0) {
        // Show AI modal — draft is still in 'draft' status
        setAiModal({ prose: data.ai_suggestions, suggestions: data.suggested_products })
        setPendingSubmitId(id)
        // Do NOT clear draft or switch view — user still needs to act
      } else {
        // No suggestions — submitted immediately
        setDraftId(null)
        setDraftItems([])
        setDraftNotes('')
        setView('history')
        await loadData()
      }
    } finally {
      setSubmitting(false)
    }
  }, [draftItems, draftId, handleSave, loadData])

  // "Добави всички и изпрати": add suggested items to draft, save, then force-submit
  const handleAIAddAndSubmit = useCallback(async (suggestions: { name: string; unit: string }[]) => {
    const id = pendingSubmitId
    setAiModal(null)
    setPendingSubmitId(null)
    if (!id) return

    // Add suggested products to draft state
    const newItems = [...draftItems]
    for (const s of suggestions) {
      const existing = newItems.find(i => i.product_name === s.name)
      if (existing) {
        existing.quantity += 1
      } else {
        newItems.push({ product_id: null, product_name: s.name, quantity: 1, unit: s.unit, note: null })
      }
    }

    // Save updated items then force-submit
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_draft', id, notes: draftNotes, items: newItems }),
    })
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', id, force: true }),
    })

    setDraftId(null)
    setDraftItems([])
    setDraftNotes('')
    setView('history')
    await loadData()
  }, [pendingSubmitId, draftItems, draftNotes, loadData])

  // "Изпрати без промяна": force-submit the draft as-is
  const handleAISubmitWithout = useCallback(async () => {
    const id = pendingSubmitId
    setAiModal(null)
    setPendingSubmitId(null)
    if (!id) return

    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', id, force: true }),
    })

    setDraftId(null)
    setDraftItems([])
    setDraftNotes('')
    setView('history')
    await loadData()
  }, [pendingSubmitId, loadData])

  const handleApprove = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id, approved_by: userName }),
    })
    await loadData()
  }, [userName, loadData])

  const handleReject = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', id }),
    })
    await loadData()
  }, [loadData])

  const handleAddAllToNew = useCallback(async (request: DeliveryRequest) => {
    addMultipleProducts(request.delivery_request_items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note,
    })))
    await handleNewRequest()
  }, [addMultipleProducts, handleNewRequest])

  const handleCleanNames = useCallback(async () => {
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_names' }),
      })
      const data = await res.json()
      setCleanResult(
        data.cleaned > 0
          ? `✓ Генерирани ${data.cleaned} имена`
          : '✓ Няма продукти за обработка'
      )
      if (data.cleaned > 0) await loadData()
      setTimeout(() => setCleanResult(null), 4000)
    } finally {
      setCleaning(false)
    }
  }, [loadData])

  const pastRequests = requests.filter(r => r.status !== 'draft')

  return {
    // Meta
    userRole, loading,
    // View
    view, setView,
    statusFilter, setStatusFilter,
    // Data
    topProducts, pastRequests,
    // Draft
    draftId, draftMonth, draftItems, draftNotes, setDraftNotes,
    saving, submitting,
    // AI modal
    aiModal, pendingSubmitId,
    // Admin
    cleaning, cleanResult,
    // Handlers
    addProduct, addMultipleProducts, updateQty, removeItem,
    handleNewRequest, handleSave, handleSubmit,
    handleAIAddAndSubmit, handleAISubmitWithout,
    handleApprove, handleReject, handleAddAllToNew, handleCleanNames,
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | grep -i "requests"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/requests/hooks/useRequests.ts
git commit -m "feat(requests): rewrite useRequests hook with view switching + AI modal handling"
```

---

### Task 14: page.tsx — wire everything together

**Files:**
- Overwrite: `app/(dashboard)/requests/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// app/(dashboard)/requests/page.tsx
'use client'

import { useRequests } from './hooks/useRequests'
import { RequestsHeader } from './components/RequestsHeader'
import { HistoryView } from './components/HistoryView'
import { NewRequestView } from './components/NewRequestView'
import { AISuggestionsModal } from './components/AISuggestionsModal'

export default function RequestsPage() {
  const r = useRequests()

  if (r.loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (r.view === 'new-request') {
    return (
      <>
        <NewRequestView
          month={r.draftMonth}
          userRole={r.userRole}
          topProducts={r.topProducts}
          draftItems={r.draftItems}
          draftNotes={r.draftNotes}
          setDraftNotes={r.setDraftNotes}
          saving={r.saving}
          submitting={r.submitting}
          onAddProduct={r.addProduct}
          onUpdateQty={r.updateQty}
          onRemoveItem={r.removeItem}
          onSave={r.handleSave}
          onSubmit={r.handleSubmit}
          onBack={() => r.setView('history')}
          onShowHistory={() => r.setView('history')}
        />
        <AISuggestionsModal
          open={r.aiModal !== null}
          prose={r.aiModal?.prose ?? ''}
          suggestions={r.aiModal?.suggestions ?? []}
          onAddAndSubmit={r.handleAIAddAndSubmit}
          onSubmitWithout={r.handleAISubmitWithout}
          onDismiss={r.handleAISubmitWithout}
        />
      </>
    )
  }

  // History view (default)
  return (
    <div className="min-h-screen">
      <RequestsHeader
        userRole={r.userRole}
        statusFilter={r.statusFilter}
        onStatusFilter={r.setStatusFilter}
        onNewRequest={r.handleNewRequest}
        cleaning={r.cleaning}
        cleanResult={r.cleanResult}
        onCleanNames={r.handleCleanNames}
      />
      <HistoryView
        requests={r.pastRequests}
        statusFilter={r.statusFilter}
        userRole={r.userRole}
        onAddAllToNew={r.handleAddAllToNew}
        onApprove={r.handleApprove}
        onReject={r.handleReject}
      />
    </div>
  )
}
```

- [ ] **Step 2: Full TypeScript check**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Run dev server and smoke test**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npm run dev
```

Open `http://localhost:3000/requests` and verify:
- История view loads with existing requests
- "+ Нова заявка" switches to new-request view
- Product picker shows top products with category pills
- "По доставчик" tab shows supplier dropdown
- Clicking a product adds it to draft panel
- Draft save + submit flow works

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/requests/page.tsx
git commit -m "feat(requests): wire page.tsx — two-view structure, AI modal, full module complete"
```

---

## Final Verification

- [ ] **TypeScript clean**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **No leftover old files**

```bash
ls app/\(dashboard\)/requests/components/
```

Expected: `AISuggestionsModal.tsx  ConfirmModal.tsx  DraftPanel.tsx  HistoryView.tsx  NewRequestView.tsx  ProductCard.tsx  ProductPicker.tsx  RequestModal.tsx  RequestsHeader.tsx`
No `PastRequests.tsx`, no `ProductSearch.tsx`.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(requests): complete ЗАЯВКИ module rebuild — two views, product picker, AI suggestions, admin approve/reject"
```
