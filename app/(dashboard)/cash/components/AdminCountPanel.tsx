// app/(dashboard)/cash/components/AdminCountPanel.tsx
import DatePicker from '@/components/ui/DatePicker'
import DiffBadge from '@/components/ui/DiffBadge'
import { formatDateShort } from '@/lib/formatters'
import { CashRecord } from '../types'

interface Props {
  adminDate: string
  adminCounted: string
  setAdminCounted: (v: string) => void
  adminSaving: boolean
  adminSaved: boolean
  adminRec: CashRecord | undefined
  grDiff: number | null
  monthStart: string
  monthEnd: string
  today: string
  isCurrentMonth: boolean
  onDateChange: (date: string) => void
  onSave: () => void
}

export function AdminCountPanel({
  adminDate, adminCounted, setAdminCounted, adminSaving, adminSaved,
  adminRec, grDiff, monthStart, monthEnd, today, isCurrentMonth,
  onDateChange, onSave,
}: Props) {
  const adminNumVal = parseFloat(adminCounted) || 0

  return (
    <div className={`border rounded-2xl p-5 ${adminSaved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-4">Проверка на касата</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <DatePicker label="Дата" value={adminDate} min={monthStart} max={isCurrentMonth ? today : monthEnd} onChange={onDateChange} />
        <div>
          <label className="text-xs text-white/70 block mb-1.5">Преброена сума (€)</label>
          <input type="number" step="0.01" value={adminCounted}
            onChange={e => { setAdminCounted(e.target.value); }}
            placeholder="0.00"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-lg font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30" />
        </div>
      </div>

      {adminRec && (adminRec.gym_cash_system != null || adminRec.gym_cash_counted != null) && (
        <div className="bg-white/[0.04] rounded-xl p-3 mb-4 space-y-2 text-sm">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Данни от рецепция — {adminRec.staff_name}</div>
          <div className="flex justify-between">
            <span className="text-white/60">По система</span>
            <span className="font-semibold text-white">{adminRec.gym_cash_system?.toFixed(2) ?? '—'}€</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Преброени</span>
            <span className="font-semibold text-white">{adminRec.gym_cash_counted?.toFixed(2) ?? '—'}€</span>
          </div>
          {adminRec.notes && (
            <div className="text-xs text-white/40 italic border-t border-white/[0.06] pt-2">{adminRec.notes}</div>
          )}
          {adminCounted && adminRec.gym_cash_counted != null && (
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/60">Разлика (преброени vs рецепция)</span>
              <DiffBadge a={adminNumVal} b={adminRec.gym_cash_counted} />
            </div>
          )}
          {adminRec.gymrealm_gym_cash != null && (
            <div className="flex justify-between border-t border-white/[0.06] pt-2">
              <span className="text-white/60">GymRealm в брой</span>
              <span className="font-semibold text-amber-400">{adminRec.gymrealm_gym_cash.toFixed(2)}€</span>
            </div>
          )}
          {grDiff != null && (
            <div className="flex justify-between">
              <span className="text-white/40 text-xs">Разлика (преброени vs GymRealm)</span>
              <DiffBadge a={adminRec.gym_cash_counted} b={adminRec.gymrealm_gym_cash} />
            </div>
          )}
        </div>
      )}

      {!adminRec && (
        <div className="text-center text-sm text-white/30 py-4 mb-4">Няма данни за {formatDateShort(adminDate)}</div>
      )}

      <button onClick={onSave} disabled={adminSaving || !adminCounted}
        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${
          adminSaved
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
        }`}>
        {adminSaving ? '...' : adminSaved ? '✓ Записано' : 'Запази броенето'}
      </button>
    </div>
  )
}
