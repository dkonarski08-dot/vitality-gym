'use client'

import { useState } from 'react'
import { useCash } from '@/app/(dashboard)/cash/hooks/useCash'
import { ReceptionistView } from '@/app/(dashboard)/cash/components/ReceptionistView'
import { ReceptionistHallView } from '@/app/(dashboard)/hall-cash/components/ReceptionistHallView'
import { formatDate } from '@/lib/formatters'

type Tab = 'fitness' | 'hall'

export default function DailyReportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('fitness')

  const {
    today, loading, error, setError,
    saved, setSaved, saving,
    gymSystem, setGymSystem,
    gymCounted, setGymCounted,
    notes, setNotes,
    hasYesterdayAlert, yesterdayStr, yesterdayRec,
    handleStaffSave, handleAckAlert,
  } = useCash()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Дневен отчет</h1>
            <p className="text-sm text-white/60 mt-0.5">{formatDate(today)}</p>
          </div>
          {/* Badge shows when fitness form is saved, regardless of active tab */}
          {saved && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ Записано
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab('fitness')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'fitness'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
            }`}>
            ОТЧЕТ — ФИТНЕС
          </button>
          <button
            onClick={() => setActiveTab('hall')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'hall'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
            }`}>
            ОТЧЕТ — ЗАЛА
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'fitness' ? (
        <ReceptionistView
          embedded
          today={today}
          saved={saved}
          setSaved={setSaved}
          saving={saving}
          error={error}
          setError={setError}
          gymSystem={gymSystem}
          setGymSystem={setGymSystem}
          gymCounted={gymCounted}
          setGymCounted={setGymCounted}
          notes={notes}
          setNotes={setNotes}
          hasYesterdayAlert={hasYesterdayAlert}
          yesterdayStr={yesterdayStr}
          yesterdayRec={yesterdayRec}
          loading={loading}
          onSave={handleStaffSave}
          onAckAlert={handleAckAlert}
        />
      ) : (
        <ReceptionistHallView />
      )}
    </div>
  )
}
