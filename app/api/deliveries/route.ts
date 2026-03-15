// app/api/deliveries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { PRODUCT_CATEGORIES } from '@/src/constants/categories'
import { GYM_ID } from '@/lib/constants'
import { serverError } from '@/lib/serverError'
const OUR_COMPANY_NAMES = ['виталити фитнес', 'vitality fitness', 'виталити фитнес оод', 'виталити']

const PARSE_PROMPT = `Анализирай тази българска фактура. Върни САМО валиден JSON без markdown.

КРИТИЧНО:
- "ВИТАЛИТИ ФИТНЕС ООД" е НАШАТА фирма — НЕ доставчикът!
- supplier_name = ДРУГАТА фирма (доставчика/издателя).
- ВСИЧКИ СУМИ СА В ЕВРО (EUR). България вече използва евро. НЕ конвертирай нищо. Ако видиш "лв" или "BGN" — това е стара бланка, сумата е ЕВРО.

За всеки продукт:
- Прочети цената от ПРАВИЛНИЯ ред — не смесвай!
- Цена 0.00 е валидна (бонус/промоция) — запиши я
- Ако не можеш да прочетеш цена — "uncertain": true
- Категоризирай: ${PRODUCT_CATEGORIES.join(', ')}

{
  "supplier_name": "Доставчик",
  "invoice_number": "Номер",
  "invoice_date": "YYYY-MM-DD",
  "payment_due_date": "YYYY-MM-DD или null",
  "payment_method": "cash"/"bank_transfer"/"card"/null,
  "subtotal": EUR без ДДС,
  "vat_amount": EUR ДДС,
  "total_amount": EUR с ДДС,
  "items": [{
    "product_name": "Пълно име",
    "product_code": "код/null",
    "quantity": число,
    "unit": "бр"/"кг"/"стек"/"л"/"кутия",
    "unit_price": EUR без ДДС (0 е валидно),
    "total_price": EUR без ДДС (0 е валидно),
    "category": "категория",
    "uncertain": true/false
  }],
  "validation": { "warnings": [] },
  "confidence": "high"/"medium"/"low",
  "notes": "бележки"
}

Цените са БЕЗ ДДС. Върни каквото можеш.`

async function callAnthropic(model: string, base64Data: string, mimeType: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No API key')

  const isPdf = mimeType === 'application/pdf'
  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg', data: base64Data } }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 3000,
      messages: [{ role: 'user', content: [
        contentBlock,
        { type: 'text', text: PARSE_PROMPT },
      ]}],
    }),
  })
  if (!response.ok) { const e = await response.text(); console.log(`[PARSE] ${model}:`, response.status, e.substring(0,200)); throw new Error(`API ${response.status}`) }
  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

async function parseInvoiceWithAI(base64Image: string, mimeType: string) {
  try {
    console.log('[PARSE] Trying Haiku...')
    const parsed = await callAnthropic('claude-haiku-4-5-20251001', base64Image, mimeType)
    console.log('[PARSE] Haiku:', parsed.confidence, parsed.items?.length, 'items')
    if (parsed.confidence === 'low' || !parsed.items || parsed.items.length === 0) {
      console.log('[PARSE] Retrying Sonnet...')
      try { const s = await callAnthropic('claude-sonnet-4-5-20250929', base64Image, mimeType); console.log('[PARSE] Sonnet:', s.confidence); return fixSupplier(s) }
      catch { return fixSupplier(parsed) }
    }
    return fixSupplier(parsed)
  } catch (e) {
    console.log('[PARSE] Haiku failed:', e)
    try { return fixSupplier(await callAnthropic('claude-sonnet-4-5-20250929', base64Image, mimeType)) }
    catch { return null }
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/** Normalise company name for comparison (strip legal suffixes, lowercase, trim) */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(еоод|оод|ад|ет|кооп|ltd|llc|gmbh)\b/g, '')
    .replace(/[^а-яёa-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

/** 0–1 similarity score between two supplier names */
function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a), nb = normaliseName(b)
  if (!na || !nb) return 0
  const maxLen = Math.max(na.length, nb.length)
  return 1 - levenshtein(na, nb) / maxLen
}

interface SupplierRow { id: string; name: string; eik: string | null; total_deliveries?: number }

function findPotentialDuplicate(
  supplierName: string,
  supplierEik: string | null,
  existing: SupplierRow[]
): SupplierRow | null {
  // 1. EIK exact match (strongest signal)
  if (supplierEik) {
    const eikMatch = existing.find(s => s.eik && s.eik.trim() === supplierEik.trim())
    if (eikMatch) return eikMatch
  }
  // 2. Name fuzzy match
  const scored = existing.map(s => ({ s, score: nameSimilarity(supplierName, s.name) }))
  const best = scored.sort((a, b) => b.score - a.score)[0]
  return best && best.score >= 0.8 ? best.s : null
}

function fixSupplier(p: Record<string, unknown>) {
  if (p.supplier_name && typeof p.supplier_name === 'string') {
    if (OUR_COMPANY_NAMES.some(n => (p.supplier_name as string).toLowerCase().includes(n))) {
      p.supplier_name = ''; p.confidence = 'low'
      const v = (p.validation as Record<string, unknown>) || {}; const w = (v.warnings as string[]) || []
      w.push('Доставчикът не е разпознат — въведи ръчно'); p.validation = { ...v, warnings: w }
    }
  }
  return p
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    if (type === 'suppliers') { const { data } = await supabase.from('suppliers').select('*').eq('gym_id', GYM_ID).eq('active', true).order('name'); return NextResponse.json({ suppliers: data || [] }) }
    if (type === 'categories') return NextResponse.json({ categories: PRODUCT_CATEGORIES })
    if (type === 'products') {
      const { data } = await supabase
        .from('delivery_products')
        .select('name, last_price, category, unit')
        .eq('gym_id', GYM_ID)
        .order('order_count', { ascending: false })
        .limit(300)
      return NextResponse.json({ products: data || [] })
    }
    const { data } = await supabase.from('deliveries').select('*, delivery_items(*)').eq('gym_id', GYM_ID).order('invoice_date', { ascending: false }).limit(200)
    return NextResponse.json({ deliveries: data || [] })
  } catch (err) { return serverError('deliveries GET', err) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'parse') {
      const { image_base64, mime_type } = body
      if (!image_base64) return NextResponse.json({ error: 'Липсва снимка' }, { status: 400 })
      const parsed = await parseInvoiceWithAI(image_base64, mime_type || 'image/jpeg')
      return NextResponse.json({ success: true, parsed: parsed || { supplier_name:'', invoice_number:'', invoice_date:'', items:[], confidence:'low', validation:{ warnings:['AI не успя — попълни ръчно'] } } })
    }

    if (action === 'upload_photo') {
      const { image_base64, mime_type, filename } = body
      const buffer = Buffer.from(image_base64, 'base64')
      const path = `invoices/${Date.now()}_${filename || 'invoice'}.${mime_type?.includes('png') ? 'png' : 'jpg'}`
      const { error: e } = await supabase.storage.from('invoices').upload(path, buffer, { contentType: mime_type || 'image/jpeg' })
      if (e) throw e
      return NextResponse.json({ success: true, url: supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl })
    }

    if (action === 'save') {
      const { supplier_name, supplier_eik, supplier_id: confirmedSupplierId, force_new, invoice_number, invoice_date, payment_due_date, payment_method, subtotal, vat_amount, total_amount, photo_url, extra_photos, ai_parsed, ai_confidence, staff_name, notes, items } = body
      let supplierId: string | null = confirmedSupplierId || null

      if (!supplierId && supplier_name) {
        // 1. Exact name match
        const { data: ex } = await supabase.from('suppliers').select('id, name, eik').eq('name', supplier_name).eq('gym_id', GYM_ID).maybeSingle()
        if (ex) {
          supplierId = ex.id
        } else if (!force_new) {
          // 2. Check for duplicates before auto-creating
          const { data: allSuppliers } = await supabase.from('suppliers').select('id, name, eik').eq('gym_id', GYM_ID).eq('active', true)
          const duplicate = findPotentialDuplicate(supplier_name, supplier_eik || null, allSuppliers || [])
          if (duplicate) {
            return NextResponse.json({
              needs_confirmation: true,
              potential_duplicate: { id: duplicate.id, name: duplicate.name, eik: duplicate.eik },
              from_invoice: { name: supplier_name, eik: supplier_eik || null },
            })
          }
          // 3. No duplicate — auto-create
          const { data: n } = await supabase.from('suppliers').insert([{ name: supplier_name, gym_id: GYM_ID }]).select('id').single()
          supplierId = n?.id
        } else {
          // force_new = true — create regardless
          const { data: n } = await supabase.from('suppliers').insert([{ name: supplier_name, gym_id: GYM_ID }]).select('id').single()
          supplierId = n?.id
        }
      }
      const allPhotos: string[] = []; if (photo_url) allPhotos.push(photo_url); if (extra_photos?.length) allPhotos.push(...extra_photos)
      const { data: delivery, error: e } = await supabase.from('deliveries').insert([{
        gym_id: GYM_ID, supplier_id: supplierId, supplier_name: supplier_name || 'Неизвестен', invoice_number, invoice_date: invoice_date || null, payment_due_date: payment_due_date || null, payment_method: payment_method || null, subtotal: subtotal ?? null, vat_amount: vat_amount ?? null, total_amount: total_amount ?? null, photo_url: allPhotos[0] || null, extra_photos: allPhotos.length > 1 ? allPhotos.slice(1) : null, ai_parsed: ai_parsed || false, ai_confidence: ai_confidence || null, staff_name: staff_name || 'Unknown', notes: notes || null, status: 'pending',
      }]).select().single()
      if (e) throw e
      if (items?.length > 0) {
        await supabase.from('delivery_items').insert(items.filter((i: Record<string, unknown>) => (i.product_name as string)?.trim()).map((i: Record<string, unknown>) => ({
          delivery_id: delivery.id, product_name: i.product_name || 'Непознат', product_code: i.product_code || null, quantity: i.quantity ?? 1, unit: i.unit || 'бр', unit_price: i.unit_price ?? null, total_price: i.total_price ?? null, expiry_date: i.expiry_date || null, category: i.category || 'Други',
        })))
      }
      return NextResponse.json({ success: true, delivery })
    }

    if (action === 'update') {
      const { id, supplier_name, invoice_number, invoice_date, payment_due_date, payment_method, total_amount, notes, status, items } = body
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (supplier_name !== undefined) updateData.supplier_name = supplier_name
      if (invoice_number !== undefined) updateData.invoice_number = invoice_number
      if (invoice_date !== undefined) updateData.invoice_date = invoice_date || null
      if (payment_due_date !== undefined) updateData.payment_due_date = payment_due_date || null
      if (payment_method !== undefined) updateData.payment_method = payment_method || null
      if (total_amount !== undefined) updateData.total_amount = total_amount ?? null
      if (notes !== undefined) updateData.notes = notes || null
      if (status !== undefined) updateData.status = status
      await supabase.from('deliveries').update(updateData).eq('id', id)
      if (items && Array.isArray(items)) {
        await supabase.from('delivery_items').delete().eq('delivery_id', id)
        if (items.length > 0) {
          await supabase.from('delivery_items').insert(items.map((i: Record<string, unknown>) => ({
            delivery_id: id, product_name: i.product_name || 'Непознат', product_code: i.product_code || null, quantity: i.quantity ?? 1, unit: i.unit || 'бр', unit_price: i.unit_price ?? null, total_price: i.total_price ?? null, expiry_date: i.expiry_date || null, category: i.category || 'Други',
          })))
        }
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      const { error } = await supabase.from('deliveries').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'approve' || action === 'reject') {
      const { id, approved_by } = body
      await supabase.from('deliveries').update({ status: action === 'approve' ? 'approved' : 'rejected', approved_by: approved_by || 'Admin', approved_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) { return serverError('deliveries POST', err) }
}
