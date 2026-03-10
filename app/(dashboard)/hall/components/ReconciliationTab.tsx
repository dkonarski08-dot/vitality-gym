// app/(dashboard)/hall/components/ReconciliationTab.tsx
import { Reconciliation, monthLabel } from '../types'

interface Props {
  reconByClass: Record<string, { multisport?: Reconciliation; coolfit?: Reconciliation }>
  selectedMonth: string
}

export function ReconciliationTab({ reconByClass, selectedMonth }: Props) {
  const COL = '1.5fr 0.8fr 0.8fr 0.6fr 0.8fr 0.8fr 0.6fr'

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Reconciliation — {monthLabel(selectedMonth)}</h2>
      {Object.keys(reconByClass).length === 0 ? (
        <div className="text-center text-white/40 py-20">
          Няма reconciliation данни.<br />
          <span className="text-sm">Качи Мултиспорт и Куулфит файлове при импорта.</span>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide" style={{ gridTemplateColumns: COL }}>
            <div>Клас</div>
            <div className="text-center">GymRealm (MS)</div><div className="text-center">Мултиспорт</div><div className="text-center">Разлика</div>
            <div className="text-center">GymRealm (CF)</div><div className="text-center">Куулфит</div><div className="text-center">Разлика</div>
          </div>
          {Object.entries(reconByClass).map(([cls, ops]) => {
            const ms = ops.multisport
            const cf = ops.coolfit
            return (
              <div key={cls} className="grid gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02]" style={{ gridTemplateColumns: COL }}>
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
  )
}
