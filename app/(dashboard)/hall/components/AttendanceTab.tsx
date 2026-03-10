// app/(dashboard)/hall/components/AttendanceTab.tsx
import { HallAttendance, pctChange } from '../types'
import type { HallAttendance as HallAttendanceHook } from '../hooks/useHallData'

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

interface Totals {
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  visits_unknown: number
  total_visits: number
  total_revenue: number
  final_payment: number
}

interface PrevTotals {
  total_visits: number
  total_revenue: number
  final_payment: number
}


interface Props {
  attendance: HallAttendance[]
  totals: Totals
  prevTotals: PrevTotals
  gymProfit: number
  prevGymProfit: number
  prevByClassId: Record<string, HallAttendance>
  isLocked: boolean
  loading: boolean
  recalculating: boolean
  applyingRecon: boolean
  restoringOriginal: boolean
  hasReconciliation: boolean
  editingId: string | null
  editValues: Partial<HallAttendanceHook>
  setEditValues: React.Dispatch<React.SetStateAction<Partial<HallAttendanceHook>>>
  onRecalculate: () => void
  onApplyReconciliation: () => void
  onRestoreOriginal: () => void
  onEditStart: (id: string) => void
  onEditCancel: () => void
  onSaveEdit: (id: string) => void
  onGoToImport: () => void
}

export function AttendanceTab({
  attendance, totals, prevTotals, gymProfit, prevGymProfit,
  prevByClassId, isLocked, loading, recalculating, applyingRecon,
  restoringOriginal, hasReconciliation, editingId, editValues, setEditValues,
  onRecalculate, onApplyReconciliation, onRestoreOriginal,
  onEditStart, onEditCancel, onSaveEdit, onGoToImport,
}: Props) {
  const COL = '1.5fr 0.7fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 0.7fr 0.5fr 0.6fr 0.7fr 60px'

  return (
    <>
      <div className="grid grid-cols-5 gap-4 mb-4">
        {[
          { label: 'Посещения', value: totals.total_visits, prev: prevTotals.total_visits, display: totals.total_visits.toString() },
          { label: 'Оборот', value: totals.total_revenue, prev: prevTotals.total_revenue, display: `${totals.total_revenue.toFixed(0)}€`, color: 'text-violet-400' },
          { label: 'Хонорари', value: totals.final_payment, prev: prevTotals.final_payment, display: `${totals.final_payment.toFixed(0)}€`, color: 'text-orange-400' },
          { label: 'Печалба', value: gymProfit, prev: prevGymProfit, display: `${gymProfit.toFixed(0)}€`, color: 'text-emerald-400' },
          { label: 'Марж', value: 0, prev: 0, display: `${totals.total_revenue > 0 ? ((gymProfit / totals.total_revenue) * 100).toFixed(1) : 0}%`, color: 'text-sky-400', noChange: true },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.display}</div>
            {!c.noChange && prevTotals.total_visits > 0 && (
              <div className="mt-1">
                <PctBadge current={c.value} prev={c.prev} />
                <span className="text-xs text-white/30 ml-1">vs пред. месец</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLocked && attendance.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={onRecalculate} disabled={recalculating} className="bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-violet-300 px-4 py-2 rounded-lg text-sm transition-colors">
            {recalculating ? '⏳ Преизчислявам...' : '🔄 Преизчисли оборота'}
          </button>
          {hasReconciliation && (
            <>
              <button
                onClick={() => { if (window.confirm('Това ще презапише броя Мултиспорт и Куулфит посещения с данните от операторите. Продължи?')) onApplyReconciliation() }}
                disabled={applyingRecon}
                className="bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 disabled:opacity-40 text-sky-300 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {applyingRecon ? '⏳ Прилагам...' : '✅ Приложи Reconciliation'}
              </button>
              <button
                onClick={() => { if (window.confirm('Това ще върне Мултиспорт и Куулфит посещения към оригиналните данни от GymRealm. Продължи?')) onRestoreOriginal() }}
                disabled={restoringOriginal}
                className="bg-white/[0.05] border border-white/10 hover:bg-white/10 disabled:opacity-40 text-white/60 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {restoringOriginal ? '⏳ Възстановявам...' : '↩ Оригинални данни'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : attendance.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-white/40 mb-4">Няма данни</div>
          <button onClick={onGoToImport} className="bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 px-6 py-3 rounded-xl text-sm transition-colors">📥 Импортирай</button>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide" style={{ gridTemplateColumns: COL }}>
            <div>Клас</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Куулфит</div><div>Празно</div><div>Общо</div><div>Оборот</div><div>%</div><div>Удръжки</div><div>Платено</div><div></div>
          </div>
          {attendance.map(row => {
            const isEditing = editingId === row.id
            const v = isEditing ? { ...row, ...editValues } : row
            const prev = prevByClassId[row.class_id]
            return (
              <div key={row.id} className={`grid gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] transition-colors ${isEditing ? 'bg-white/[0.04]' : ''}`} style={{ gridTemplateColumns: COL }}>
                <div>
                  <div className="text-sm font-medium text-white">{row.hall_classes?.name}</div>
                  <div className="text-xs text-white/40">{row.instructor_percent}%</div>
                </div>
                {isEditing ? (
                  <>
                    {(['visits_cash', 'visits_subscription', 'visits_multisport', 'visits_coolfit'] as const).map(f => (
                      <input key={f} type="number" value={v[f]} onChange={e => setEditValues(p => ({ ...p, [f]: parseInt(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    ))}
                    <div className="text-sm text-white/40">{v.visits_unknown || 0}</div>
                    <div className="text-sm text-white">{v.visits_cash + v.visits_subscription + v.visits_multisport + v.visits_coolfit}</div>
                    <div className="text-sm text-violet-400">{v.total_revenue.toFixed(0)}€</div>
                    <input type="number" value={v.instructor_percent} onChange={e => setEditValues(p => ({ ...p, instructor_percent: parseFloat(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    <input type="number" value={v.adjustments} onChange={e => setEditValues(p => ({ ...p, adjustments: parseFloat(e.target.value) || 0 }))} className="bg-white/5 border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-full focus:outline-none" />
                    <div className="text-sm font-bold text-orange-400">{(v.total_revenue * (v.instructor_percent / 100) + (v.adjustments || 0)).toFixed(0)}€</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-white/80">{row.visits_cash}{prev && <PctBadge current={row.visits_cash} prev={prev.visits_cash} />}</div>
                    <div className="text-sm text-white/80">{row.visits_subscription}{prev && <PctBadge current={row.visits_subscription} prev={prev.visits_subscription} />}</div>
                    <div className="text-sm text-white/80">{row.visits_multisport}{prev && <PctBadge current={row.visits_multisport} prev={prev.visits_multisport} />}</div>
                    <div className="text-sm text-white/80">{row.visits_coolfit}{prev && <PctBadge current={row.visits_coolfit} prev={prev.visits_coolfit} />}</div>
                    <div className="text-sm text-white/40">{row.visits_unknown || 0}</div>
                    <div className="text-sm font-medium text-white">{row.total_visits}{prev && <PctBadge current={row.total_visits} prev={prev.total_visits} />}</div>
                    <div className="text-sm text-violet-400 font-medium">{row.total_revenue.toFixed(0)}€</div>
                    <div className="text-sm text-white/60">{row.instructor_percent}%</div>
                    <div className={`text-sm ${row.adjustments !== 0 ? (row.adjustments > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/20'}`}>{row.adjustments !== 0 ? `${row.adjustments > 0 ? '+' : ''}${row.adjustments}` : '—'}</div>
                    <div className="text-sm font-bold text-orange-400">{row.final_payment.toFixed(0)}€</div>
                  </>
                )}
                <div className="flex gap-1">
                  {!isLocked && (isEditing
                    ? <><button onClick={() => onSaveEdit(row.id)} className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded">✓</button><button onClick={onEditCancel} className="text-xs bg-white/[0.05] border border-white/10 text-white/50 px-2 py-1 rounded">✗</button></>
                    : <button onClick={() => onEditStart(row.id)} className="text-xs bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/50 px-2 py-1 rounded transition-colors">✎</button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="grid gap-2 px-4 py-3 border-t-2 border-white/10 bg-white/[0.02] font-semibold text-sm" style={{ gridTemplateColumns: COL }}>
            <div className="text-white">ОБЩО</div>
            <div className="text-white/80">{totals.visits_cash}</div><div className="text-white/80">{totals.visits_subscription}</div><div className="text-white/80">{totals.visits_multisport}</div><div className="text-white/80">{totals.visits_coolfit}</div>
            <div className="text-white/40">{totals.visits_unknown}</div>
            <div className="font-bold text-white">{totals.total_visits}</div>
            <div className="text-violet-400 font-bold">{totals.total_revenue.toFixed(0)}€</div>
            <div></div><div></div>
            <div className="text-orange-400 font-bold">{totals.final_payment.toFixed(0)}€</div>
            <div></div>
          </div>
        </div>
      )}
    </>
  )
}
