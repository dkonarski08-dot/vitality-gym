// app/(dashboard)/cash/components/ReceptionistView.tsx
import { CashRecord } from '../types'
import { CashHeader } from './CashHeader'
import { formatDate, formatDateShort } from '@/lib/formatters'

interface Props {
  today: string
  saved: boolean
  setSaved: (v: boolean) => void
  saving: boolean
  error: string | null
  setError: (v: string | null) => void
  gymSystem: string
  setGymSystem: (v: string) => void
  gymCounted: string
  setGymCounted: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  hasYesterdayAlert: boolean
  yesterdayStr: string
  yesterdayRec: CashRecord | undefined
  loading: boolean
  onSave: () => void
  onAckAlert: (date: string) => void
}

export function ReceptionistView({
  today, saved, setSaved, saving, error, setError,
  gymSystem, setGymSystem, gymCounted, setGymCounted,
  notes, setNotes, hasYesterdayAlert, yesterdayStr, yesterdayRec,
  loading, onSave, onAckAlert,
}: Props) {
  return (
    <div className="min-h-screen">
      <CashHeader title="Дневна каса — Фитнес" subtitle={formatDate(today)} saved={saved} />

      <div className="p-6 max-w-sm mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <span>⚠️ {error}</span>
                <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {hasYesterdayAlert && yesterdayRec && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-red-400 mb-1">⚠️ Разлика от вчера ({formatDateShort(yesterdayStr)})</div>
                    <div className="text-sm text-red-300">
                      Ти: {yesterdayRec.gym_cash_counted?.toFixed(2)}€ / Admin: {yesterdayRec.admin_cash_counted?.toFixed(2)}€
                    </div>
                  </div>
                  <button onClick={() => onAckAlert(yesterdayStr)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/70 border border-white/10 hover:bg-white/15 shrink-0">
                    Видяно ✓
                  </button>
                </div>
              </div>
            )}

            <div className={`border rounded-2xl p-5 ${saved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
              <div className="text-xs text-white/50 uppercase tracking-widest mb-5">{formatDate(today)}</div>
              <div className="mb-4">
                <label className="text-xs text-white/70 block mb-1.5">По система (€)</label>
                <input type="number" step="0.01" value={gymSystem}
                  onChange={e => { setGymSystem(e.target.value); setSaved(false) }}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/20" />
              </div>

              <div className="mb-5">
                <label className="text-xs text-white/70 block mb-1.5">Преброени (€)</label>
                <input type="number" step="0.01" value={gymCounted}
                  onChange={e => { setGymCounted(e.target.value); setSaved(false) }}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/20" />
              </div>

              <div className="mb-5">
                <label className="text-xs text-white/70 block mb-1.5">Бележка (по желание)</label>
                <textarea value={notes}
                  onChange={e => { setNotes(e.target.value); setSaved(false) }}
                  placeholder="Забележка за деня..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:border-amber-400/50 focus:outline-none placeholder:text-white/30 resize-none" />
              </div>

              <button onClick={onSave}
                disabled={saving || (!gymSystem && !gymCounted)}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${
                  saved
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                }`}>
                {saving ? 'Запазвам...' : saved ? '✓ Записано — натисни за промяна' : 'Запази'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
