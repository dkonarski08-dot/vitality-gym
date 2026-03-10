// app/(dashboard)/cash/components/CashHistoryTable.tsx
import { CashRecord } from '../types'
import { formatDateShort } from '@/lib/formatters'

interface Props {
  records: CashRecord[]
  adminDate: string
  today: string
  onRowClick: (date: string) => void
}

export function CashHistoryTable({ records, adminDate, today, onRowClick }: Props) {
  return (
    <>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-3">История</div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-1 px-4 py-2.5 bg-white/[0.03] text-xs text-white/40 uppercase tracking-wider">
          <div>Дата</div>
          <div>Служител</div>
          <div className="text-right">По система</div>
          <div className="text-right">Преброени</div>
          <div className="text-right">Admin</div>
          <div className="text-right">GymRealm</div>
        </div>
        {records.map(r => {
          const isSelected = r.date === adminDate
          const hasAlert = r.alert_physical_diff || r.alert_system_diff
          const isToday = r.date === today
          return (
            <div key={r.id}
              onClick={() => onRowClick(r.date)}
              className={`grid grid-cols-6 gap-1 px-4 py-2.5 border-t border-white/[0.06] text-sm items-center cursor-pointer transition-colors hover:bg-white/[0.03] ${
                isSelected ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500/40'
                : hasAlert ? 'bg-red-500/[0.04]'
                : isToday ? 'bg-amber-500/[0.02]'
                : ''
              }`}>
              <div className="text-white/70 flex items-center gap-1">
                {formatDateShort(r.date)}
                {hasAlert && <span className="text-red-400 text-xs">⚠</span>}
                {isToday && <span className="text-amber-400 text-xs">●</span>}
              </div>
              <div className="text-white/50 truncate text-xs">{r.staff_name || '—'}</div>
              <div className="text-right text-white/60">{r.gym_cash_system?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
              <div className="text-right font-medium text-white/80">{r.gym_cash_counted?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
              <div className={`text-right font-medium ${r.admin_cash_counted != null ? (r.alert_physical_diff ? 'text-red-400' : 'text-emerald-400') : 'text-white/20'}`}>
                {r.admin_cash_counted?.toFixed(2) ?? '—'}
              </div>
              <div className="text-right text-amber-400">{r.gymrealm_gym_cash?.toFixed(2) ?? <span className="text-white/20">—</span>}</div>
            </div>
          )
        })}
        {records.length === 0 && (
          <div className="text-center text-white/30 py-10 text-sm">Няма записи</div>
        )}
      </div>
    </>
  )
}
