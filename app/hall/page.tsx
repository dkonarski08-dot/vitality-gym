'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']

interface HallClass { id: string; name: string; instructor_percent: number; price_cash: number; price_subscription: number; price_multisport: number; price_coolfit: number; max_capacity: number; duration_minutes: number }
interface HallAttendance { id: string; class_id: string; month: string; visits_cash: number; visits_subscription: number; visits_multisport: number; visits_coolfit: number; visits_unknown: number; total_visits: number; revenue_cash: number; revenue_subscription: number; revenue_multisport: number; revenue_coolfit: number; total_revenue: number; instructor_percent: number; instructor_fee: number; adjustments: number; adjustment_notes: string; final_payment: number; hall_classes?: HallClass }
interface Reconciliation { id: string; month: string; operator: string; class_name: string; visits_gymrealm: number; visits_operator: number; difference: number; rate_eur: number; total_eur: number; total_bgn: number; status: string }
interface YearlyRow { month: string; total_visits: number; visits_cash: number; visits_subscription: number; visits_multisport: number; visits_coolfit: number; total_revenue: number; total_payments: number; gym_profit: number; margin_percent: number; is_locked: boolean }
interface ClientVisit { client_name: string; class_name: string; months_active: number; total_visits: number; first_seen: string; last_seen: string }
interface NoShowClient { client_name: string; client_phone: string | null; class_name: string; total_noshows: number; total_visits: number; noshow_percent: number; last_noshow: string }
interface LapsedClient { client_name: string; last_seen: string; total_visits: number; classes: string }

// ─── Coolfit PDF parser (runs in browser) ───
async function parseCoolfitInBrowser(file: File): Promise<Record<string, { visits: number; rate_eur: number; total_eur: number }>> {
  const text = await file.text()
  const results: Record<string, { visits: number; rate_eur: number; total_eur: number }> = {}
  const nameMap: Record<string, string> = {
    'рашко': 'Класическа йога', 'rashko': 'Класическа йога', 'yoga': 'Класическа йога',
    'флоу': 'Виняса Флоу Йога', 'flow': 'Виняса Флоу Йога', 'vinyasa': 'Виняса Флоу Йога',
    'пилатес': 'Пилатес', 'pilates': 'Пилатес',
    'зумба': 'Zumba Fitness', 'zumba': 'Zumba Fitness',
    'фит': 'Fit Lady', 'lady fit': 'Fit Lady',
  }
  const lines = text.split(/[\n\r]+/).map((l: string) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/^(.+?)\s+(\d+)\s+([\d.]+)\s*€.*?([\d.]+)\s*€/)
    if (!match) continue
    const rawName = match[1].toLowerCase().trim()
    const visits = parseInt(match[2])
    const rate = parseFloat(match[3])
    const total = parseFloat(match[4])
    const mappedKey = Object.keys(nameMap).find(k => rawName.includes(k))
    if (mappedKey && visits > 0) results[nameMap[mappedKey]] = { visits, rate_eur: rate, total_eur: total }
  }
  console.log('Coolfit browser parsed:', results)
  return results
}

// ─── % change helper ───
function pctChange(current: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((current - prev) / prev) * 100)
}

function PctBadge({ current, prev }: { current: number; prev: number }) {
  const pct = pctChange(current, prev)
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ml-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

export default function HallPage() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'yearly' | 'reconciliation' | 'clients' | 'import' | 'config'>('attendance')
  const [selectedMonth, setSelectedMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01` })
  const [attendance, setAttendance] = useState<HallAttendance[]>([])
  const [prevAttendance, setPrevAttendance] = useState<HallAttendance[]>([])
  const [classes, setClasses] = useState<HallClass[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation[]>([])
  const [yearlyData, setYearlyData] = useState<YearlyRow[]>([])
  const [allClients, setAllClients] = useState<ClientVisit[]>([])
  const [noshows, setNoshows] = useState<NoShowClient[]>([])
  const [lapsedClients, setLapsedClients] = useState<LapsedClient[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [applyingRecon, setApplyingRecon] = useState(false)
  const [restoringOriginal, setRestoringOriginal] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [gymrealmFile, setGymrealmFile] = useState<File | null>(null)
  const [multisportFile, setMultisportFile] = useState<File | null>(null)
  const [coolfitFile, setCoolfitFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<HallAttendance>>({})
  const [periodFrom, setPeriodFrom] = useState<string>('')
  const [periodTo, setPeriodTo] = useState<string>('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  const monthLabel = (m?: string) => { const d = new Date(m || selectedMonth); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
  const prevMonth = () => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() - 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`) }
  const nextMonth = () => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() + 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`) }

  // Get previous month string
  const getPrevMonth = (m: string) => {
    const d = new Date(m)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const prevMonthStr = getPrevMonth(selectedMonth)
    const [{ data: att }, { data: prevAtt }, { data: cls }, { data: recon }, { data: yearly }, { data: cv }, { data: ns }, { data: lapsed }, { data: ms }] = await Promise.all([
      supabase.from('hall_attendance').select('*, hall_classes(*)').eq('month', selectedMonth).order('hall_classes(name)'),
      supabase.from('hall_attendance').select('*, hall_classes(*)').eq('month', prevMonthStr),
      supabase.from('hall_classes').select('*').eq('active', true).order('name'),
      supabase.from('hall_reconciliation').select('*').eq('month', selectedMonth).order('class_name'),
      supabase.from('hall_yearly_overview').select('*').order('month', { ascending: false }),
      supabase.from('hall_client_summary').select('*').order('total_visits', { ascending: false }),
      supabase.from('hall_noshow_summary').select('*').order('total_noshows', { ascending: false }),
      supabase.from('hall_lapsed_clients').select('*').order('last_seen', { ascending: false }),
      supabase.from('hall_month_status').select('is_locked').eq('month', selectedMonth).single(),
    ])
    setAttendance(att || [])
    setPrevAttendance(prevAtt || [])
    setClasses(cls || [])
    setReconciliation(recon || [])
    setYearlyData(yearly || [])
    setAllClients(cv || [])
    setNoshows(ns || [])
    setLapsedClients(lapsed || [])
    setIsLocked(ms?.is_locked || false)
    const allMonths = [...new Set([...(yearly || []).map(r => r.month?.substring(0, 7))])].sort()
    setAvailableMonths(allMonths)
    if (!periodFrom && allMonths.length > 0) { setPeriodFrom(allMonths[0]); setPeriodTo(allMonths[allMonths.length - 1]) }
    setLoading(false)
  }, [selectedMonth, periodFrom])

  useEffect(() => { loadData() }, [loadData])

  const filteredClients = allClients.filter(c => { if (!periodFrom || !periodTo) return true; const ls = c.last_seen?.substring(0, 7) || ''; return ls >= periodFrom && ls <= periodTo })
  const filteredNoshows = noshows.filter(c => { if (!periodFrom || !periodTo) return true; const ln = c.last_noshow?.substring(0, 7) || ''; return ln >= periodFrom && ln <= periodTo })
  const newClients = allClients.filter(c => { const fs = c.first_seen?.substring(0, 7) || ''; return fs >= periodFrom && fs <= periodTo })
  const uniqueActiveClients = [...new Set(filteredClients.map(c => c.client_name))]

  const toggleLock = async () => {
    if (isLocked && !confirm('Сигурен ли си че искаш да отключиш този месец?')) return
    const newLocked = !isLocked
    await supabase.from('hall_month_status').upsert([{ month: selectedMonth, is_locked: newLocked, locked_at: newLocked ? new Date().toISOString() : null }], { onConflict: 'month' })
    setIsLocked(newLocked)
  }

  const handleImport = async () => {
    if (!gymrealmFile) { setImportResult('❌ Качи GymRealm файл'); return }
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('month', selectedMonth)
      fd.append('gymrealm', gymrealmFile)
      if (multisportFile) fd.append('multisport', multisportFile)
      if (coolfitFile) {
        const coolfitParsed = await parseCoolfitInBrowser(coolfitFile)
        fd.append('coolfit_json', JSON.stringify(coolfitParsed))
      }
      const res = await fetch('/api/hall/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setImportResult(`❌ ${data.error}`) }
      else { setImportResult(`✅ Импортирани ${data.classes_processed} класа за ${monthLabel()}`); loadData(); setActiveTab('attendance') }
    } catch (e) { setImportResult(`❌ ${e instanceof Error ? e.message : 'Грешка'}`) }
    finally { setImporting(false) }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    const res = await fetch('/api/hall/recalculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: selectedMonth }) })
    const data = await res.json()
    if (data.success) loadData()
    setRecalculating(false)
  }

  // Apply reconciliation — update visits_multisport and visits_coolfit from operator data
  const handleApplyReconciliation = async () => {
    if (!confirm('Това ще презапише броя Мултиспорт и Куулфит посещения с данните от операторите. Продължи?')) return
    setApplyingRecon(true)
    try {
      for (const row of reconciliation) {
        const attRow = attendance.find(a => a.hall_classes?.name === row.class_name)
        if (!attRow) continue
        const field = row.operator === 'multisport' ? 'visits_multisport' : 'visits_coolfit'
        await supabase.from('hall_attendance').update({ [field]: row.visits_operator }).eq('id', attRow.id)
      }
      await loadData()
      alert('✅ Reconciliation приложен успешно')
    } catch (e) {
      alert(`❌ Грешка: ${e instanceof Error ? e.message : String(e)}`)
    }
    setApplyingRecon(false)
  }
const handleRestoreOriginal = async () => {
  if (!confirm('Това ще върне Мултиспорт и Куулфит посещения към оригиналните данни от GymRealm. Продължи?')) return
  setRestoringOriginal(true)
  try {
    for (const row of reconciliation) {
      const attRow = attendance.find(a => a.hall_classes?.name === row.class_name)
      if (!attRow) continue
      const field = row.operator === 'multisport' ? 'visits_multisport' : 'visits_coolfit'
      await supabase.from('hall_attendance').update({ [field]: row.visits_gymrealm }).eq('id', attRow.id)
    }
    await loadData()
    alert('✅ Оригиналните данни са възстановени')
  } catch (e) {
    alert(`❌ Грешка: ${e instanceof Error ? e.message : String(e)}`)
  }
  setRestoringOriginal(false)
}
  const saveEdit = async (id: string) => {
    const row = attendance.find(a => a.id === id)
    if (!row) return
    const updated = { ...row, ...editValues }
    const instructorFee = updated.total_revenue * (updated.instructor_percent / 100)
    const finalPayment = instructorFee + (updated.adjustments || 0)
    await supabase.from('hall_attendance').update({ visits_cash: updated.visits_cash, visits_subscription: updated.visits_subscription, visits_multisport: updated.visits_multisport, visits_coolfit: updated.visits_coolfit, instructor_percent: updated.instructor_percent, adjustments: updated.adjustments, adjustment_notes: updated.adjustment_notes, instructor_fee: instructorFee, final_payment: finalPayment }).eq('id', id)
    setEditingId(null); setEditValues({}); loadData()
  }

  const totals = attendance.reduce((acc, r) => ({
    visits_cash: acc.visits_cash + r.visits_cash,
    visits_subscription: acc.visits_subscription + r.visits_subscription,
    visits_multisport: acc.visits_multisport + r.visits_multisport,
    visits_coolfit: acc.visits_coolfit + r.visits_coolfit,
    visits_unknown: acc.visits_unknown + (r.visits_unknown || 0),
    total_visits: acc.total_visits + (r.total_visits || 0),
    total_revenue: acc.total_revenue + r.total_revenue,
    final_payment: acc.final_payment + r.final_payment,
  }), { visits_cash: 0, visits_subscription: 0, visits_multisport: 0, visits_coolfit: 0, visits_unknown: 0, total_visits: 0, total_revenue: 0, final_payment: 0 })

  const prevTotals = prevAttendance.reduce((acc, r) => ({
    total_visits: acc.total_visits + (r.total_visits || 0),
    total_revenue: acc.total_revenue + r.total_revenue,
    final_payment: acc.final_payment + r.final_payment,
  }), { total_visits: 0, total_revenue: 0, final_payment: 0 })

  const gymProfit = totals.total_revenue - totals.final_payment
  const prevGymProfit = prevTotals.total_revenue - prevTotals.final_payment

  // Per-class previous month lookup
  const prevByClassId: Record<string, HallAttendance> = {}
  for (const r of prevAttendance) prevByClassId[r.class_id] = r

  const reconByClass: Record<string, { multisport?: Reconciliation; coolfit?: Reconciliation }> = {}
  for (const r of reconciliation) {
    if (!reconByClass[r.class_name]) reconByClass[r.class_name] = {}
    reconByClass[r.class_name][r.operator as 'multisport' | 'coolfit'] = r
  }

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent, setFile: (f: File | null) => void) => {
    e.preventDefault(); setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) setFile(file)
  }

  const tabs = [
    { key: 'attendance', label: '📊 Месечни данни' },
    { key: 'yearly', label: '📅 Година' },
    { key: 'reconciliation', label: '🔄 Reconciliation' },
    { key: 'clients', label: '👥 Клиенти' },
    { key: 'import', label: '📥 Import' },
    { key: 'config', label: '⚙️ Настройки' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center font-bold text-sm">VH</div>
          <div><h1 className="font-semibold">Vitality Hall</h1><p className="text-xs text-gray-400">Групови тренировки</p></div>
        </div>
        <div className="flex items-center gap-3">
          {isLocked && <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-3 py-1 rounded-full">🔒 Заключен</span>}
          <button onClick={prevMonth} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">‹</button>
          <span className="text-sm font-semibold w-36 text-center">{monthLabel()}</span>
          <button onClick={nextMonth} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">›</button>
          <button onClick={toggleLock} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLocked ? 'bg-yellow-700 hover:bg-yellow-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}>
            {isLocked ? '🔓 Отключи' : '🔒 Заключи'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900 px-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* ══════════════ MONTHLY DATA ══════════════ */}
        {activeTab === 'attendance' && (
          <>
            {/* Summary cards with % change */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              {[
                { label: 'Посещения', value: totals.total_visits, prev: prevTotals.total_visits, display: totals.total_visits.toString() },
                { label: 'Оборот', value: totals.total_revenue, prev: prevTotals.total_revenue, display: `${totals.total_revenue.toFixed(0)} лв`, color: 'text-purple-400' },
                { label: 'Хонорари', value: totals.final_payment, prev: prevTotals.final_payment, display: `${totals.final_payment.toFixed(0)} лв`, color: 'text-orange-400' },
                { label: 'Печалба', value: gymProfit, prev: prevGymProfit, display: `${gymProfit.toFixed(0)} лв`, color: 'text-green-400' },
                { label: 'Марж', value: 0, prev: 0, display: `${totals.total_revenue > 0 ? ((gymProfit / totals.total_revenue) * 100).toFixed(1) : 0}%`, color: 'text-blue-400', noChange: true },
              ].map((c, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{c.label}</div>
                  <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.display}</div>
                  {!c.noChange && prevTotals.total_visits > 0 && (
                    <div className="mt-1">
                      <PctBadge current={c.value} prev={c.prev} />
                      <span className="text-xs text-gray-600 ml-1">vs пред. месец</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            {!isLocked && attendance.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button onClick={handleRecalculate} disabled={recalculating} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm">
                  {recalculating ? 'Преизчислявам...' : '🔄 Преизчисли оборота'}
                </button>
                {reconciliation.length > 0 && (
  <>
    <button onClick={handleApplyReconciliation} disabled={applyingRecon} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm">
      {applyingRecon ? 'Прилагам...' : '✅ Приложи Reconciliation'}
    </button>
    <button onClick={handleRestoreOriginal} disabled={restoringOriginal} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm">
      {restoringOriginal ? 'Възстановявам...' : '↩ Оригинални данни'}
    </button>
  </>
)}
              </div>
            )}

            {loading ? <div className="text-center text-gray-500 py-20">Зареждам...</div>
              : attendance.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-gray-500 mb-4">Няма данни за {monthLabel()}</div>
                  <button onClick={() => setActiveTab('import')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm">📥 Импортирай</button>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="grid gap-2 px-4 py-3 bg-gray-950 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 0.7fr 0.5fr 0.6fr 0.7fr 60px' }}>
                    <div>Клас</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Куулфит</div><div>Празно</div><div>Общо</div><div>Оборот</div><div>%</div><div>Удръжки</div><div>Платено</div><div></div>
                  </div>
                  {attendance.map(row => {
                    const isEditing = editingId === row.id
                    const v = isEditing ? { ...row, ...editValues } : row
                    const prev = prevByClassId[row.class_id]
                    return (
                      <div key={row.id} className={`grid gap-2 px-4 py-3 border-t border-gray-800 items-center hover:bg-gray-800/30 ${isEditing ? 'bg-gray-800/50' : ''}`} style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 0.7fr 0.5fr 0.6fr 0.7fr 60px' }}>
                        <div>
                          <div className="text-sm font-medium">{row.hall_classes?.name}</div>
                          <div className="text-xs text-gray-500">{row.instructor_percent}%</div>
                        </div>
                        {isEditing ? (
                          <>
                            {(['visits_cash', 'visits_subscription', 'visits_multisport', 'visits_coolfit'] as const).map(f => (
                              <input key={f} type="number" value={v[f]} onChange={e => setEditValues(p => ({ ...p, [f]: parseInt(e.target.value) || 0 }))} className="bg-gray-700 border border-purple-500 rounded px-2 py-1 text-xs text-white w-full" />
                            ))}
                            <div className="text-sm text-gray-500">{v.visits_unknown || 0}</div>
                            <div className="text-sm">{v.visits_cash + v.visits_subscription + v.visits_multisport + v.visits_coolfit}</div>
                            <div className="text-sm text-purple-400">{v.total_revenue.toFixed(0)} лв</div>
                            <input type="number" value={v.instructor_percent} onChange={e => setEditValues(p => ({ ...p, instructor_percent: parseFloat(e.target.value) || 0 }))} className="bg-gray-700 border border-purple-500 rounded px-2 py-1 text-xs text-white w-full" />
                            <input type="number" value={v.adjustments} onChange={e => setEditValues(p => ({ ...p, adjustments: parseFloat(e.target.value) || 0 }))} className="bg-gray-700 border border-purple-500 rounded px-2 py-1 text-xs text-white w-full" />
                            <div className="text-sm font-bold text-orange-400">{(v.total_revenue * (v.instructor_percent / 100) + (v.adjustments || 0)).toFixed(0)} лв</div>
                          </>
                        ) : (
                          <>
                            {/* В брой */}
                            <div className="text-sm">
                              {row.visits_cash}
                              {prev && <PctBadge current={row.visits_cash} prev={prev.visits_cash} />}
                            </div>
                            {/* Абон */}
                            <div className="text-sm">
                              {row.visits_subscription}
                              {prev && <PctBadge current={row.visits_subscription} prev={prev.visits_subscription} />}
                            </div>
                            {/* Мулти */}
                            <div className="text-sm">
                              {row.visits_multisport}
                              {prev && <PctBadge current={row.visits_multisport} prev={prev.visits_multisport} />}
                            </div>
                            {/* Куулфит */}
                            <div className="text-sm">
                              {row.visits_coolfit}
                              {prev && <PctBadge current={row.visits_coolfit} prev={prev.visits_coolfit} />}
                            </div>
                            {/* Празно */}
                            <div className="text-sm text-gray-500">{row.visits_unknown || 0}</div>
                            {/* Общо */}
                            <div className="text-sm font-medium">
                              {row.total_visits}
                              {prev && <PctBadge current={row.total_visits} prev={prev.total_visits} />}
                            </div>
                            <div className="text-sm text-purple-400">{row.total_revenue.toFixed(0)} лв</div>
                            <div className="text-sm">{row.instructor_percent}%</div>
                            <div className={`text-sm ${row.adjustments !== 0 ? (row.adjustments > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>{row.adjustments !== 0 ? `${row.adjustments > 0 ? '+' : ''}${row.adjustments}` : '—'}</div>
                            <div className="text-sm font-bold text-orange-400">{row.final_payment.toFixed(0)} лв</div>
                          </>
                        )}
                        <div className="flex gap-1">
                          {!isLocked && (isEditing
                            ? <><button onClick={() => saveEdit(row.id)} className="text-xs bg-green-700 text-white px-2 py-1 rounded">✓</button><button onClick={() => { setEditingId(null); setEditValues({}) }} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">✗</button></>
                            : <button onClick={() => { setEditingId(row.id); setEditValues({}) }} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-1 rounded">✎</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {/* Totals row */}
                  <div className="grid gap-2 px-4 py-3 border-t-2 border-gray-700 bg-gray-950 font-semibold text-sm" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 0.7fr 0.5fr 0.6fr 0.7fr 60px' }}>
                    <div>ОБЩО</div>
                    <div>{totals.visits_cash}</div>
                    <div>{totals.visits_subscription}</div>
                    <div>{totals.visits_multisport}</div>
                    <div>{totals.visits_coolfit}</div>
                    <div className="text-gray-500">{totals.visits_unknown}</div>
                    <div className="font-bold">{totals.total_visits}</div>
                    <div className="text-purple-400 font-bold">{totals.total_revenue.toFixed(0)} лв</div>
                    <div></div><div></div>
                    <div className="text-orange-400 font-bold">{totals.final_payment.toFixed(0)} лв</div>
                    <div></div>
                  </div>
                </div>
              )}
          </>
        )}

        {/* ══════════════ YEARLY ══════════════ */}
        {activeTab === 'yearly' && (
          <div>
            <h2 className="text-lg font-semibold mb-6">Годишен преглед</h2>
            {yearlyData.length === 0 ? <div className="text-center text-gray-500 py-20">Няма данни</div> : (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Общо посещения', value: yearlyData.reduce((a, r) => a + r.total_visits, 0) },
                    { label: 'Общ оборот', value: `${yearlyData.reduce((a, r) => a + r.total_revenue, 0).toFixed(0)} лв`, color: 'text-purple-400' },
                    { label: 'Общо хонорари', value: `${yearlyData.reduce((a, r) => a + r.total_payments, 0).toFixed(0)} лв`, color: 'text-orange-400' },
                    { label: 'Обща печалба', value: `${yearlyData.reduce((a, r) => a + r.gym_profit, 0).toFixed(0)} лв`, color: 'text-green-400' },
                  ].map((c, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{c.label}</div>
                      <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-gray-950 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div>Месец</div><div>Посещения</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Оборот</div><div>Печалба</div><div>Статус</div>
                  </div>
                  {yearlyData.map((row, i) => (
                    <div key={i} className="grid grid-cols-8 gap-2 px-4 py-3 border-t border-gray-800 items-center hover:bg-gray-800/30 cursor-pointer" onClick={() => { setSelectedMonth(row.month); setActiveTab('attendance') }}>
                      <div className="text-sm font-medium">{monthLabel(row.month)}</div>
                      <div className="text-sm">{row.total_visits}</div>
                      <div className="text-sm text-gray-400">{row.visits_cash}</div>
                      <div className="text-sm text-gray-400">{row.visits_subscription}</div>
                      <div className="text-sm text-gray-400">{row.visits_multisport}</div>
                      <div className="text-sm text-purple-400">{row.total_revenue.toFixed(0)} лв</div>
                      <div className="text-sm text-green-400">{row.gym_profit.toFixed(0)} лв</div>
                      <div>{row.is_locked ? <span className="text-xs text-yellow-400">🔒 Заключен</span> : <span className="text-xs text-blue-400">● Отворен</span>}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════ RECONCILIATION ══════════════ */}
        {activeTab === 'reconciliation' && (
          <div>
            <h2 className="text-lg font-semibold mb-6">Reconciliation — {monthLabel()}</h2>
            {Object.keys(reconByClass).length === 0 ? (
              <div className="text-center text-gray-500 py-20">Няма reconciliation данни.<br /><span className="text-sm">Качи Мултиспорт и Куулфит файлове при импорта.</span></div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid gap-2 px-4 py-3 bg-gray-950 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.6fr 0.8fr 0.8fr 0.6fr' }}>
                  <div>Клас</div>
                  <div className="text-center">GymRealm (MS)</div>
                  <div className="text-center">Мултиспорт</div>
                  <div className="text-center">Разлика</div>
                  <div className="text-center">GymRealm (CF)</div>
                  <div className="text-center">Куулфит</div>
                  <div className="text-center">Разлика</div>
                </div>
                {Object.entries(reconByClass).map(([cls, ops]) => {
                  const ms = ops.multisport
                  const cf = ops.coolfit
                  return (
                    <div key={cls} className="grid gap-2 px-4 py-3 border-t border-gray-800 items-center hover:bg-gray-800/30" style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.6fr 0.8fr 0.8fr 0.6fr' }}>
                      <div className="text-sm font-medium">{cls}</div>
                      <div className="text-sm text-center">{ms ? ms.visits_gymrealm : '—'}</div>
                      <div className="text-sm text-center">{ms ? ms.visits_operator : '—'}</div>
                      <div className={`text-sm text-center font-bold ${!ms ? 'text-gray-600' : ms.difference === 0 ? 'text-green-400' : ms.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {ms ? (ms.difference > 0 ? `+${ms.difference}` : ms.difference === 0 ? '✓' : ms.difference) : '—'}
                      </div>
                      <div className="text-sm text-center">{cf ? cf.visits_gymrealm : '—'}</div>
                      <div className="text-sm text-center">{cf ? cf.visits_operator : '—'}</div>
                      <div className={`text-sm text-center font-bold ${!cf ? 'text-gray-600' : cf.difference === 0 ? 'text-green-400' : cf.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {cf ? (cf.difference > 0 ? `+${cf.difference}` : cf.difference === 0 ? '✓' : cf.difference) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ CLIENTS ══════════════ */}
        {activeTab === 'clients' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Период за анализ</div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">От:</span>
                  <select value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none">
                    {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">До:</span>
                  <select value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none">
                    {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 ml-auto">
                  {[3, 6, 12].map(months => {
                    const to = availableMonths[availableMonths.length - 1] || ''
                    const fromDate = new Date(to + '-01')
                    fromDate.setMonth(fromDate.getMonth() - months + 1)
                    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`
                    return <button key={months} onClick={() => { setPeriodFrom(from); setPeriodTo(to) }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs">Последни {months}м</button>
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Активни клиенти', value: uniqueActiveClients.length, color: 'text-green-400', sub: 'посещавали в периода' },
                { label: 'Нови клиенти', value: newClients.length, color: 'text-blue-400', sub: 'първо посещение в периода' },
                { label: 'Отпаднали', value: lapsedClients.length, color: 'text-orange-400', sub: 'не са идвали 30+ дни' },
                { label: 'No-shows', value: filteredNoshows.reduce((a, c) => a + c.total_noshows, 0), color: 'text-red-400', sub: 'резервации без присъствие' },
              ].map((c, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{c.label}</div>
                  <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                  <div className="text-xs text-gray-600 mt-1">{c.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">🏆 Топ 15 — Най-редовни</h3>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {filteredClients.slice(0, 15).map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-600 w-5 font-mono">{i + 1}</div>
                        <div><div className="text-sm font-medium">{c.client_name}</div><div className="text-xs text-gray-500">{c.class_name}</div></div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-400">{c.total_visits} посещения</div>
                        <div className="text-xs text-gray-500">{c.months_active} месеца</div>
                      </div>
                    </div>
                  ))}
                  {filteredClients.length === 0 && <div className="text-center text-gray-500 py-8 text-sm">Няма данни за периода</div>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">⚠️ Топ No-shows</h3>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {filteredNoshows.slice(0, 15).map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-600 w-5 font-mono">{i + 1}</div>
                        <div>
                          <div className="text-sm font-medium">{c.client_name}</div>
                          <div className="text-xs text-gray-500">{c.class_name}</div>
                          {c.client_phone && <div className="text-xs text-blue-400 mt-0.5">📞 {c.client_phone}</div>}
                          <div className="text-xs text-gray-600">Последен: {c.last_noshow ? monthLabel(c.last_noshow) : '—'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-400">{c.total_noshows} no-show</div>
                        <div className="text-xs text-gray-500">{c.noshow_percent}% от резервации</div>
                      </div>
                    </div>
                  ))}
                  {filteredNoshows.length === 0 && <div className="text-center text-gray-500 py-8 text-sm">Няма no-shows за периода</div>}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">📉 Отпаднали клиенти — не са идвали 30+ дни</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-950 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <div>Клиент</div><div>Последно посещение</div><div>Класове</div><div>Общо посещения</div>
                </div>
                {lapsedClients.map((c, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-gray-800 items-center hover:bg-gray-800/30">
                    <div className="text-sm font-medium">{c.client_name}</div>
                    <div className="text-sm text-orange-400">{c.last_seen ? monthLabel(c.last_seen) : '—'}</div>
                    <div className="text-xs text-gray-400">{c.classes}</div>
                    <div className="text-sm">{c.total_visits}</div>
                  </div>
                ))}
                {lapsedClients.length === 0 && <div className="text-center text-gray-500 py-8 text-sm">Няма отпаднали клиенти</div>}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ IMPORT ══════════════ */}
        {activeTab === 'import' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-2">Import</h2>

            {/* Month selector prominent */}
            <div className="bg-gray-900 border border-purple-800 rounded-xl p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Месец за импорт</div>
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">‹</button>
                <span className="text-lg font-bold text-purple-400 w-40 text-center">{monthLabel()}</span>
                <button onClick={nextMonth} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">›</button>
              </div>
            </div>

            {isLocked && <div className="bg-yellow-900/30 border border-yellow-800 rounded-xl p-4 mb-6 text-yellow-400 text-sm">🔒 Месецът е заключен. Отключи го за да импортираш.</div>}

            <div className="space-y-4">
              {[
                { key: 'gymrealm', label: 'GymRealm Export', required: true, accept: '.xlsx,.xls', file: gymrealmFile, setFile: setGymrealmFile },
                { key: 'multisport', label: 'Мултиспорт Service Report', required: false, accept: '.xlsx,.xls,.csv', file: multisportFile, setFile: setMultisportFile },
                { key: 'coolfit', label: 'Куулфит Report (PDF)', required: false, accept: '.pdf,.xlsx', file: coolfitFile, setFile: setCoolfitFile },
              ].map(item => (
                <div key={item.key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.required ? 'Задължителен' : 'По избор — за reconciliation'}</div>
                    </div>
                    {item.file && <span className="text-xs text-green-400">✓ {item.file.name}</span>}
                  </div>
                  <label
                    className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${dragOver === item.key ? 'border-purple-500 bg-purple-900/20' : item.file ? 'border-green-700 bg-green-900/20' : 'border-gray-700 hover:border-gray-500'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(item.key) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => handleDrop(e, item.setFile)}
                  >
                    <input type="file" accept={item.accept} className="hidden" onChange={e => item.setFile(e.target.files?.[0] || null)} />
                    <span className="text-sm text-gray-400">{item.file ? '🔄 Смени файл' : '📁 Избери или провлачи файл тук'}</span>
                  </label>
                </div>
              ))}
            </div>
            {importResult && (
              <div className={`mt-4 p-4 rounded-xl text-sm ${importResult.startsWith('✅') ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>{importResult}</div>
            )}
            <button onClick={handleImport} disabled={importing || !gymrealmFile || isLocked}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white py-3 rounded-xl font-medium transition-colors">
              {importing ? 'Импортирам...' : `📥 Импортирай за ${monthLabel()}`}
            </button>
          </div>
        )}

        {/* ══════════════ CONFIG ══════════════ */}
        {activeTab === 'config' && (
          <div>
            <h2 className="text-lg font-semibold mb-6">Настройки на класовете</h2>
            <div className="space-y-3">
              {classes.map(cls => (
                <div key={cls.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">{cls.name}</div>
                    <div className="text-xs text-gray-500">{cls.duration_minutes} мин • Макс. {cls.max_capacity} души</div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 text-xs">
                    {[
                      { label: 'В брой (лв)', field: 'price_cash', value: cls.price_cash },
                      { label: 'Абонамент (лв)', field: 'price_subscription', value: cls.price_subscription },
                      { label: 'Мултиспорт (лв)', field: 'price_multisport', value: cls.price_multisport },
                      { label: 'Куулфит (лв)', field: 'price_coolfit', value: cls.price_coolfit },
                      { label: '% Инструктор', field: 'instructor_percent', value: cls.instructor_percent },
                      { label: 'Капацитет', field: 'max_capacity', value: cls.max_capacity },
                    ].map(f => (
                      <div key={f.field}>
                        <div className="text-gray-500 mb-1">{f.label}</div>
                        <input type="number" defaultValue={f.value} onBlur={async e => { const val = parseFloat(e.target.value); await supabase.from('hall_classes').update({ [f.field]: val }).eq('id', cls.id) }}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white w-full focus:border-purple-500 focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {classes.length === 0 && <div className="text-center text-gray-500 py-10">Първо импортирай GymRealm файл.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}