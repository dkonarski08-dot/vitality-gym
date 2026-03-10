// app/(dashboard)/hall/components/YearlyTab.tsx
import { YearlyRow, monthLabel } from '../types'

interface Props {
  yearlyData: YearlyRow[]
  onSelectMonth: (month: string) => void
}

export function YearlyTab({ yearlyData, onSelectMonth }: Props) {
  if (yearlyData.length === 0) {
    return <div className="text-center text-gray-500 py-20">Няма данни</div>
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Годишен преглед</h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Общо посещения', value: yearlyData.reduce((a, r) => a + r.total_visits, 0) },
          { label: 'Общ оборот', value: `${yearlyData.reduce((a, r) => a + r.total_revenue, 0).toFixed(0)}€`, color: 'text-violet-400' },
          { label: 'Общо хонорари', value: `${yearlyData.reduce((a, r) => a + r.total_payments, 0).toFixed(0)}€`, color: 'text-orange-400' },
          { label: 'Обща печалба', value: `${yearlyData.reduce((a, r) => a + r.gym_profit, 0).toFixed(0)}€`, color: 'text-emerald-400' },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide">
          <div>Месец</div><div>Посещения</div><div>В брой</div><div>Абон.</div><div>Мулти.</div><div>Оборот</div><div>Печалба</div><div>Статус</div>
        </div>
        {yearlyData.map((row, i) => (
          <div key={i} className="grid grid-cols-8 gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] cursor-pointer transition-colors"
            onClick={() => onSelectMonth(row.month)}>
            <div className="text-sm font-medium text-white">{monthLabel(row.month + '-01')}</div>
            <div className="text-sm text-white/80">{row.total_visits}</div>
            <div className="text-sm text-white/50">{row.visits_cash}</div>
            <div className="text-sm text-white/50">{row.visits_subscription}</div>
            <div className="text-sm text-white/50">{row.visits_multisport}</div>
            <div className="text-sm text-violet-400 font-medium">{row.total_revenue.toFixed(0)}€</div>
            <div className="text-sm text-emerald-400 font-medium">{row.gym_profit.toFixed(0)}€</div>
            <div>{row.is_locked ? <span className="text-xs text-yellow-400">🔒 Заключен</span> : <span className="text-xs text-blue-400">● Отворен</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
