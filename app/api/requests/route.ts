// app/api/requests/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'
import { requireRole, getSession } from '@/lib/requireRole'
import { getCurrentMonthISO } from '@/lib/formatters'
import { serverError } from '@/lib/serverError'

export async function GET(req: NextRequest) {
  const authError = requireRole(req, 'admin', 'receptionist', 'instructor')
  if (authError) return authError
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    // Autocomplete search — searches name AND clean_name
    if (type === 'search') {
      const q = searchParams.get('q') || ''
      // Sanitize: strip PostgREST filter metacharacters to prevent injection
      const safeQ = q.replace(/[%,()]/g, '').trim()
      if (safeQ.length < 2) return NextResponse.json({ products: [] })
      const { data } = await supabase
        .from('delivery_products')
        .select('id, name, clean_name, category, unit, last_price, order_count')
        .eq('gym_id', GYM_ID)
        .or(`name.ilike.%${safeQ}%,clean_name.ilike.%${safeQ}%`)
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

      // Deduplicate by case-insensitive name (defensive guard)
      const seen = new Set<string>()
      const uniqueSuppliers = suppliers.filter(s => {
        const key = s.supplier_name.toLowerCase().trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return NextResponse.json({ suppliers: uniqueSuppliers })
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

    // Default: list all requests + items
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, delivery_request_items(*)')
      .eq('gym_id', GYM_ID)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ requests: data || [] })
  } catch (err) {
    return serverError('requests GET', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body as { action: string } & Record<string, unknown>

    // ── create_draft ─────────────────────────────────────────────────────────
    if (action === 'create_draft') {
      const { created_by } = body as { created_by: string }
      const month = getCurrentMonthISO()

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
      const approveErr = requireRole(req, 'admin')
      if (approveErr) return approveErr
      const session = getSession(req)!
      const { id } = body as { id: string }
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      await supabase
        .from('delivery_requests')
        .update({ status: 'approved', approved_by: session.name, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    // ── reject ────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const rejectErr = requireRole(req, 'admin')
      if (rejectErr) return rejectErr
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
      const cleanErr = requireRole(req, 'admin')
      if (cleanErr) return cleanErr
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
    return serverError('requests POST', err)
  }
}
