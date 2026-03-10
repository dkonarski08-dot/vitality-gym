'use client'

import { useState } from 'react'
import { useHallData } from './hooks/useHallData'
import { useAttendance } from './hooks/useAttendance'
import { useImport } from './hooks/useImport'
import { TabKey } from './types'
import { HallHeader } from './components/HallHeader'
import { AttendanceTab } from './components/AttendanceTab'
import { YearlyTab } from './components/YearlyTab'
import { ReconciliationTab } from './components/ReconciliationTab'
import { ClientsTab } from './components/ClientsTab'
import { ImportTab } from './components/ImportTab'
import { ConfigTab } from './components/ConfigTab'

const MONTHS_LOCAL = ['Јануари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
function localMonthLabel(dateStr?: string): string {
  const d = new Date(dateStr || new Date().toISOString())
  return `${MONTHS_LOCAL[d.getMonth()]} ${d.getFullYear()}`
}

export default function HallPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('attendance')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  const prevMonth = () => {
    const d = new Date(selectedMonth)
    d.setMonth(d.getMonth() - 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  const nextMonth = () => {
    const d = new Date(selectedMonth)
    d.setMonth(d.getMonth() + 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const {
    attendance, prevAttendance, classes, reconciliation,
    yearlyData, allClients, noshows, lapsedClients,
    availableMonths, isLocked, loading, error: dataError,
    loadData, toggleLock,
  } = useHallData(selectedMonth)

  const {
    editingId, setEditingId, editValues, setEditValues,
    recalculating, applyingRecon, restoringOriginal,
    saveError, setSaveError,
    saveEdit, handleRecalculate, handleApplyReconciliation, handleRestoreOriginal,
  } = useAttendance(attendance, reconciliation, selectedMonth, loadData)

  const {
    importing, importResult,
    gymrealmFile, setGymrealmFile,
    multisportFile, setMultisportFile,
    coolfitFile, setCoolfitFile,
    dragOver, setDragOver,
    handleImport, handleDrop,
  } = useImport(selectedMonth, localMonthLabel, loadData, setActiveTab)

  // Derived: attendance totals
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

  const prevByClassId: Record<string, typeof prevAttendance[0]> = {}
  for (const r of prevAttendance) prevByClassId[r.class_id] = r

  const reconByClass: Record<string, { multisport?: typeof reconciliation[0]; coolfit?: typeof reconciliation[0] }> = {}
  for (const r of reconciliation) {
    if (!reconByClass[r.class_name]) reconByClass[r.class_name] = {}
    reconByClass[r.class_name][r.operator as 'multisport' | 'coolfit'] = r
  }

  const filteredClients = allClients.filter(c => {
    if (!periodFrom || !periodTo) return true
    const ls = c.last_seen?.substring(0, 7) || ''
    return ls >= periodFrom && ls <= periodTo
  })
  const filteredNoshows = noshows.filter(c => {
    if (!periodFrom || !periodTo) return true
    const ln = c.last_noshow?.substring(0, 7) || ''
    return ln >= periodFrom && ln <= periodTo
  })
  const newClients = allClients.filter(c => {
    const fs = c.first_seen?.substring(0, 7) || ''
    return fs >= periodFrom && fs <= periodTo
  })
  const uniqueActiveClients = [...new Set(filteredClients.map(c => c.client_name))]

  // Normalize null -> undefined for client_phone to match ClientsTab's NoShowClient type
  const normalizedNoshows = filteredNoshows.map(c => ({
    ...c,
    client_phone: c.client_phone ?? undefined,
  }))

  return (
    <div className="min-h-screen">
      <HallHeader
        selectedMonth={selectedMonth}
        isLocked={isLocked}
        activeTab={activeTab}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onToggleLock={toggleLock}
        onTabChange={setActiveTab}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {dataError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <span>⚠️ {dataError}</span>
            <button onClick={loadData} className="ml-auto text-xs underline hover:no-underline">Опитай пак</button>
          </div>
        )}
        {saveError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <span>⚠️ {saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab
            attendance={attendance}
            totals={totals}
            prevTotals={prevTotals}
            gymProfit={gymProfit}
            prevGymProfit={prevGymProfit}
            prevByClassId={prevByClassId}
            isLocked={isLocked}
            loading={loading}
            recalculating={recalculating}
            applyingRecon={applyingRecon}
            restoringOriginal={restoringOriginal}
            hasReconciliation={reconciliation.length > 0}
            editingId={editingId}
            editValues={editValues}
            setEditValues={setEditValues}
            onRecalculate={handleRecalculate}
            onApplyReconciliation={handleApplyReconciliation}
            onRestoreOriginal={handleRestoreOriginal}
            onEditStart={(id) => { setEditingId(id); setEditValues({}) }}
            onEditCancel={() => { setEditingId(null); setEditValues({}) }}
            onSaveEdit={saveEdit}
            onGoToImport={() => setActiveTab('import')}
          />
        )}
        {activeTab === 'yearly' && (
          <YearlyTab
            yearlyData={yearlyData}
            onSelectMonth={(month) => { setSelectedMonth(month); setActiveTab('attendance') }}
          />
        )}
        {activeTab === 'reconciliation' && (
          <ReconciliationTab reconByClass={reconByClass} selectedMonth={selectedMonth} />
        )}
        {activeTab === 'clients' && (
          <ClientsTab
            availableMonths={availableMonths}
            periodFrom={periodFrom}
            periodTo={periodTo}
            setPeriodFrom={setPeriodFrom}
            setPeriodTo={setPeriodTo}
            filteredClients={filteredClients}
            filteredNoshows={normalizedNoshows}
            newClients={newClients}
            lapsedClients={lapsedClients}
            uniqueActiveClients={uniqueActiveClients}
          />
        )}
        {activeTab === 'import' && (
          <ImportTab
            selectedMonth={selectedMonth}
            isLocked={isLocked}
            importing={importing}
            importResult={importResult}
            gymrealmFile={gymrealmFile}
            multisportFile={multisportFile}
            coolfitFile={coolfitFile}
            dragOver={dragOver}
            setGymrealmFile={setGymrealmFile}
            setMultisportFile={setMultisportFile}
            setCoolfitFile={setCoolfitFile}
            setDragOver={setDragOver}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onImport={handleImport}
            onDrop={handleDrop}
          />
        )}
        {activeTab === 'config' && <ConfigTab classes={classes} />}
      </div>
    </div>
  )
}
