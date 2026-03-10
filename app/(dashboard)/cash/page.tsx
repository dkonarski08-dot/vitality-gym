// app/(dashboard)/cash/page.tsx
'use client'

import { useCash } from './hooks/useCash'
import { CashHeader } from './components/CashHeader'
import { ReceptionistView } from './components/ReceptionistView'
import { AdminKpiCards } from './components/AdminKpiCards'
import { AdminCountPanel } from './components/AdminCountPanel'
import { GymRealmImportPanel } from './components/GymRealmImportPanel'
import { AlertsSection } from './components/AlertsSection'
import { CashHistoryTable } from './components/CashHistoryTable'
import { MONTHS_BG, formatDate } from '@/lib/formatters'

export default function CashPage() {
  const c = useCash()

  if (c.userRole !== 'admin') {
    return (
      <ReceptionistView
        today={c.today}
        saved={c.saved}
        setSaved={c.setSaved}
        saving={c.saving}
        error={c.error}
        setError={c.setError}
        gymSystem={c.gymSystem}
        setGymSystem={c.setGymSystem}
        gymCounted={c.gymCounted}
        setGymCounted={c.setGymCounted}
        notes={c.notes}
        setNotes={c.setNotes}
        hasYesterdayAlert={c.hasYesterdayAlert}
        yesterdayStr={c.yesterdayStr}
        yesterdayRec={c.yesterdayRec}
        loading={c.loading}
        onSave={c.handleStaffSave}
        onAckAlert={c.handleAckAlert}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <CashHeader title="Дневна каса — Фитнес" subtitle={formatDate(c.today)} />

      <div className="p-6 max-w-5xl mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={c.goToPrevMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">
            ‹
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-white">{MONTHS_BG[c.viewMonth]} {c.viewYear}</div>
            {!c.isCurrentMonth && (
              <button onClick={() => {
                const now = new Date()
                c.resetToMonth(now.getFullYear(), now.getMonth())
              }} className="text-xs text-amber-400/70 hover:text-amber-400 mt-0.5">→ Текущ месец</button>
            )}
          </div>
          <button onClick={c.goToNextMonth} disabled={c.isCurrentMonth}
            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
            ›
          </button>
        </div>

        {c.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {c.error && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <span>⚠️ {c.error}</span>
                <button onClick={() => c.setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            <AdminKpiCards
              alertCount={c.alertRecords.length}
              recordsWithDataCount={c.recordsWithData.length}
              gymrealmImportCount={c.records.filter(r => r.gymrealm_gym_cash != null).length}
              viewMonth={c.viewMonth}
            />

            <div className="grid grid-cols-2 gap-6 mb-6">
              <AdminCountPanel
                adminDate={c.adminDate}
                adminCounted={c.adminCounted}
                setAdminCounted={c.setAdminCounted}
                adminSaving={c.adminSaving}
                adminSaved={c.adminSaved}
                adminRec={c.adminRec}
                grDiff={c.grDiff}
                monthStart={c.monthStart}
                monthEnd={c.monthEnd}
                today={c.today}
                isCurrentMonth={c.isCurrentMonth}
                onDateChange={c.handleAdminDateChange}
                onSave={c.handleAdminSave}
              />
              <GymRealmImportPanel
                importFile={c.importFile}
                setImportFile={c.setImportFile}
                importing={c.importing}
                importResult={c.importResult}
                dragOver={c.dragOver}
                setDragOver={c.setDragOver}
                fileInputRef={c.fileInputRef}
                setImportResult={c.setImportResult}
                onImport={c.handleImport}
              />
            </div>

            <AlertsSection alertRecords={c.alertRecords} />

            <CashHistoryTable
              records={c.records}
              adminDate={c.adminDate}
              today={c.today}
              onRowClick={c.handleAdminDateChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
