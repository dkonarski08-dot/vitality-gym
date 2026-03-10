// app/(dashboard)/cash/components/AdminKpiCards.tsx
import { MONTHS_BG } from '@/lib/formatters'

interface Props {
  alertCount: number
  recordsWithDataCount: number
  gymrealmImportCount: number
  viewMonth: number
}

export function AdminKpiCards({ alertCount, recordsWithDataCount, gymrealmImportCount, viewMonth }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Аномалии</div>
        <div className={`text-2xl font-bold ${alertCount === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {alertCount}
        </div>
        <div className="text-xs text-white/30 mt-0.5">несъвпадения</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">Дни с данни</div>
        <div className="text-2xl font-bold text-amber-400">{recordsWithDataCount}</div>
        <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">GymRealm импорти</div>
        <div className="text-2xl font-bold text-white">{gymrealmImportCount}</div>
        <div className="text-xs text-white/30 mt-0.5">{MONTHS_BG[viewMonth]}</div>
      </div>
    </div>
  )
}
