import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

// =============================================
// AI CLASS NAME NORMALIZER
// =============================================
const GYM_ID = '00000000-0000-0000-0000-000000000001'

async function normalizeClassNamesWithAI(
  gymrealmNames: string[],
  multisportNames: string[],
  coolfitNames: string[]
): Promise<Record<string, string>> {
  const allNames = [...new Set([...gymrealmNames, ...multisportNames, ...coolfitNames])]

  // 1. Провери cache в DB
  const { data: cached } = await supabase
    .from('class_name_mappings')
    .select('raw_name, normalized_name')
    .eq('gym_id', GYM_ID)
    .in('raw_name', allNames)

  const mapping: Record<string, string> = {}
  const cachedNames = new Set<string>()

  for (const row of cached || []) {
    mapping[row.raw_name] = row.normalized_name
    cachedNames.add(row.raw_name)
  }

  // 2. Намери непознати имена
  const unknownNames = allNames.filter(n => !cachedNames.has(n))
  console.log('Cached:', [...cachedNames], 'Unknown:', unknownNames)

  if (unknownNames.length === 0) return mapping

  // 3. Викай AI само за непознати
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Нормализирай имената на групови тренировки. Върни САМО валиден JSON без markdown.

Имена: ${JSON.stringify(unknownNames)}

Правила:
- Fit Lady = Lady Fit = Фит Лейди → "Fit Lady"
- Зумба варианти → "Zumba Fitness"
- Виняса/Vinyasa/Flow/Флоу → "Виняса Флоу Йога"
- Йога/Yoga/Рашко/Класическа → "Класическа йога"
- Пилатес/Pilates → "Пилатес"
- Народни танци → "Народни танци"
- Ин Йога/свещи → "Ин Йога"

{"оригинално име": "стандартизирано име"}`
        }]
      })
    })
    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const aiResult = JSON.parse(clean)

    // 4. Запази новите mapping-и в DB
    const toInsert = Object.entries(aiResult).map(([raw, normalized]) => ({
      gym_id: GYM_ID,
      raw_name: raw,
      normalized_name: normalized,
    }))
    if (toInsert.length > 0) {
      await supabase.from('class_name_mappings').upsert(toInsert, { onConflict: 'gym_id,raw_name' })
    }

    return { ...mapping, ...aiResult }
  } catch (e) {
    console.error('AI normalize failed:', e)
    return mapping
  }
}

// =============================================
// CLASSIFY SERVICE TYPE
// =============================================
function classifyService(service: string): 'cash' | 'subscription' | 'multisport' | 'coolfit' | 'unknown' {
  if (!service || service.trim() === '') return 'unknown'
  const s = service.toLowerCase()
  if (s.includes('mulltisport') || s.includes('multisport')) return 'multisport'
  if (s.includes('coolfit')) return 'coolfit'
  if (s.includes('8 посещения') || s.includes('абонамент') || s.includes('рашко 8')) return 'subscription'
  if (s.includes('посещение') || s.includes('лв') || s.includes('hall')) return 'cash'
  return 'unknown'
}

// =============================================
// NORMALIZE CLASS NAMES (fallback)
// =============================================
function normalizeClassName(name: string): string {
  const n = name.toLowerCase().trim()
  if (n.includes('ин йога') || n.includes('свещи')) return 'Ин Йога'
  if (n.includes('рашко') || n.includes('rashko')) return 'Класическа йога'
  if (n.includes('виняса') || n.includes('флоу') || n.includes('flow') || n.includes('vinyasa')) return 'Виняса Флоу Йога'
  if (n.includes('fit lady') || n.includes('lady fit') || n.includes('фит лейди')) return 'Fit Lady'
  if (n.includes('зумба') || n.includes('zumba')) return 'Zumba Fitness'
  if (n.includes('пилатес') || n.includes('pilates')) return 'Пилатес'
  if (n.includes('класическа')) return 'Класическа йога'
  if (n.includes('йога') || n.includes('yoga')) return 'Класическа йога'
  if (n.includes('народни') || n.includes('танци')) return 'Народни танци'
  if (n.includes('фит')) return 'Fit Lady'
  return name
}

// =============================================
// GYMREALM PARSER
// =============================================
function parseGymRealm(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] as string[]).includes('Дата')) { headerIdx = i; break }
  }
  if (headerIdx === -1) throw new Error('Не намерих header ред в GymRealm файла')

  const headers = rows[headerIdx] as string[]
  const classIdx = headers.indexOf('Име')
  const attendanceIdx = headers.indexOf('Присъствие')
  const serviceIdx = headers.indexOf('Име на услугата')
  const instructorIdx = headers.indexOf('Инструктор')
  const clientIdx = headers.indexOf('Клиент')

  type ClassData = {
    instructor: string
    cash: number
    subscription: number
    multisport: number
    coolfit: number
    unknown: number
    clients: Record<string, number>
    noshows: Record<string, number>
  }

  const results: Record<string, ClassData> = {}

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (!row[0]) continue

    const className = String(row[classIdx] || '').trim()
    const attended = String(row[attendanceIdx] || '').trim()
    const service = String(row[serviceIdx] || '').trim()
    const instructor = String(row[instructorIdx] || '').trim()
    const client = String(row[clientIdx] || '').trim()

    if (!className) continue

    if (!results[className]) {
      results[className] = { instructor, cash: 0, subscription: 0, multisport: 0, coolfit: 0, unknown: 0, clients: {}, noshows: {} }
    }

    if (attended === 'Да') {
      const visitType = classifyService(service)
      results[className][visitType]++
      if (client && client !== 'Анонимен') {
        results[className].clients[client] = (results[className].clients[client] || 0) + 1
      }
    } else if (attended === 'Не') {
      if (client && client !== 'Анонимен') {
        results[className].noshows[client] = (results[className].noshows[client] || 0) + 1
      }
    }
  }

  return results
}

// =============================================
// MULTISPORT PARSER
// =============================================
function parseMultisport(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const results: Record<string, { visits: number; amount_eur: number }> = {}

  for (const row of rows as (string | number)[][]) {
    const name = String(row[0] || '').trim()
    const visits = Number(row[1]) || 0
    const amount = Number(row[2]) || 0
    if (!name || !visits || name === 'УСЛУГА') continue
    results[name] = { visits, amount_eur: amount }
  }

  return results
}

// =============================================
// MAIN HANDLER
// =============================================
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const month = formData.get('month') as string
    const gymrealmFile = formData.get('gymrealm') as File | null
    const multisportFile = formData.get('multisport') as File | null

    if (!month) return NextResponse.json({ error: 'Липсва месец' }, { status: 400 })
    if (!gymrealmFile) return NextResponse.json({ error: 'Липсва GymRealm файл' }, { status: 400 })

    // Check lock
    const { data: monthStatus } = await supabase
      .from('hall_month_status')
      .select('is_locked')
      .eq('month', month)
      .single()

    if (monthStatus?.is_locked) {
      return NextResponse.json({ error: 'Този месец е заключен.' }, { status: 403 })
    }

    // Parse all files first
    const gymrealmBuffer = await gymrealmFile.arrayBuffer()
    const gymrealmData = parseGymRealm(gymrealmBuffer)

    let multisportData: Record<string, { visits: number; amount_eur: number }> = {}
    if (multisportFile) {
      const buf = await multisportFile.arrayBuffer()
      multisportData = parseMultisport(buf)
    }

    let coolfitData: Record<string, { visits: number; rate_eur: number; total_eur: number }> = {}
    const coolfitJson = formData.get('coolfit_json') as string | null
    if (coolfitJson) {
      try { coolfitData = JSON.parse(coolfitJson) } catch (e) { console.error('coolfit_json parse error:', e) }
    }

    // AI normalize class names (with fallback)
    const aiMapping = await normalizeClassNamesWithAI(
      Object.keys(gymrealmData),
      Object.keys(multisportData),
      Object.keys(coolfitData)
    )
    console.log('AI mapping:', aiMapping)
    console.log('GymRealm:', Object.entries(gymrealmData).map(([k, v]) => `${k}: cash=${v.cash} sub=${v.subscription} ms=${v.multisport} cf=${v.coolfit} unk=${v.unknown}`))

    // Get existing classes
    const { data: existingClasses } = await supabase.from('hall_classes').select('*')
    const classMap: Record<string, { id: string; instructor_percent: number; price_cash: number; price_subscription: number; price_multisport: number; price_coolfit: number }> = {}
    for (const cls of existingClasses || []) {
      classMap[cls.name] = cls
    }

    const results = []
    const reconciliationResults = []

    for (const [rawClassName, data] of Object.entries(gymrealmData)) {
      const className = aiMapping[rawClassName] || normalizeClassName(rawClassName)

      // Get or create class
      let classRecord = classMap[className]
      if (!classRecord) {
        const { data: newClass } = await supabase
          .from('hall_classes')
          .insert([{ name: className, instructor_percent: 50 }])
          .select()
          .single()
        if (newClass) {
          classRecord = newClass
          classMap[className] = newClass
        }
      }
      if (!classRecord) continue

 // Calculate revenue
      const revCash = data.cash * (classRecord.price_cash || 0)
      const revSub = data.subscription * (classRecord.price_subscription || 0)
      const revMulti = data.multisport * (classRecord.price_multisport || 0)
      const revCool = data.coolfit * (classRecord.price_coolfit || 0)
      const totalRevenue = revCash + revSub + revMulti + revCool
      // instructor_fee и final_payment се изчисляват от DB trigger

      // Delete + insert (avoids upsert issues)
      await supabase.from('hall_attendance').delete().eq('class_id', classRecord.id).eq('month', month)
      const { error: attError } = await supabase.from('hall_attendance').insert([{
        class_id: classRecord.id,
        month,
        visits_cash: data.cash,
        visits_subscription: data.subscription,
        visits_multisport: data.multisport,
        visits_coolfit: data.coolfit,
        visits_unknown: data.unknown,
        revenue_cash: revCash,
        revenue_subscription: revSub,
        revenue_multisport: revMulti,
        revenue_coolfit: revCool,
        total_revenue: totalRevenue,
        instructor_percent: classRecord.instructor_percent,
      }])
      if (attError) console.error('Attendance insert error:', attError)

      results.push({ class: className, cash: data.cash, sub: data.subscription, ms: data.multisport, cf: data.coolfit, unk: data.unknown })

      // Client visits
      for (const [clientName, visitCount] of Object.entries(data.clients)) {
        await supabase.from('hall_client_visits').upsert([{
          class_id: classRecord.id, month, client_name: clientName, visit_count: visitCount,
        }], { onConflict: 'class_id,month,client_name' })
      }

      // No-shows
      for (const [clientName, noshowCount] of Object.entries(data.noshows)) {
        await supabase.from('hall_client_noshows').upsert([{
          class_id: classRecord.id, month, client_name: clientName, noshow_count: noshowCount,
        }], { onConflict: 'class_id,month,client_name' })
      }

      // Reconciliation — Multisport
      const multiKey = Object.keys(multisportData).find(k => (aiMapping[k] || normalizeClassName(k)) === className)
      if (multiKey) {
        const op = multisportData[multiKey]
        await supabase.from('hall_reconciliation').upsert([{
          month, operator: 'multisport', class_name: className,
          visits_gymrealm: data.multisport, visits_operator: op.visits,
          rate_eur: op.visits > 0 ? op.amount_eur / op.visits : 0,
          total_eur: op.amount_eur, total_bgn: op.amount_eur * 1.95583,
          status: data.multisport === op.visits ? 'ok' : 'discrepancy',
        }], { onConflict: 'month,operator,class_name' })
        reconciliationResults.push({ class: className, operator: 'multisport' })
      }

      // Reconciliation — Coolfit
      const coolEntry = coolfitData[className]
      if (coolEntry) {
        await supabase.from('hall_reconciliation').upsert([{
          month, operator: 'coolfit', class_name: className,
          visits_gymrealm: data.coolfit, visits_operator: coolEntry.visits,
          rate_eur: coolEntry.rate_eur, total_eur: coolEntry.total_eur,
          total_bgn: coolEntry.total_eur * 1.95583,
          status: data.coolfit === coolEntry.visits ? 'ok' : 'discrepancy',
        }], { onConflict: 'month,operator,class_name' })
        reconciliationResults.push({ class: className, operator: 'coolfit' })
      }
    }

    await supabase.from('hall_month_status').upsert([{ month, is_locked: false }], { onConflict: 'month' })

    return NextResponse.json({
      success: true, month,
      classes_processed: results.length,
      results, reconciliation: reconciliationResults,
    })

  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}