// app/(dashboard)/hall/components/YearlyTab.tsx
import { YearlyRow, monthLabel } from '../types'

function StatCard({
  label, value, sub, accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-white/40">{label}</div>
      <div className={`text-2xl font-bold tabular-nums leading-none ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  )
}

const COL = '2fr 1fr 0.7fr 0.7fr 0.8fr 0.8fr 1fr 1fr 1.1fr 1fr 1.2fr'

interface Props {
  yearlyData: YearlyRow[]
  onSelectMonth: (month: string) => void
}

export function YearlyTab({ yearlyData, onSelectMonth }: Props) {
  if (yearlyData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/30">
        <div className="text-4xl mb-3 opacity-40">📅</div>
        <div className="text-sm">Няма данни</div>
      </div>
    )
  }

  const totalVisits     = yearlyData.reduce((a, r) => a + Number(r.total_visits), 0)
  const totalRevenue    = yearlyData.reduce((a, r) => a + Number(r.total_revenue), 0)
  const totalMultisport = yearlyData.reduce((a, r) => a + Number(r.revenue_multisport), 0)
  const totalCoolfit    = yearlyData.reduce((a, r) => a + Number(r.revenue_coolfit), 0)
  const totalPayments   = yearlyData.reduce((a, r) => a + Number(r.total_payments), 0)
  const totalProfit     = yearlyData.reduce((a, r) => a + Number(r.gym_profit), 0)

  return (
    <div className="space-y-5">

      {/* ── Totals ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="Посещения"      value={totalVisits}                        accent="text-white" />
        <StatCard label="Оборот"         value={`€${totalRevenue.toFixed(0)}`}      accent="text-violet-400" />
        <StatCard label="Мулти. оборот"  value={`€${totalMultisport.toFixed(0)}`}   accent="text-sky-400"
          sub={totalRevenue > 0 ? `${((totalMultisport / totalRevenue) * 100).toFixed(0)}% от оборота` : undefined} />
        <StatCard label="Куулфит оборот" value={`€${totalCoolfit.toFixed(0)}`}      accent="text-indigo-400"
          sub={totalRevenue > 0 ? `${((totalCoolfit / totalRevenue) * 100).toFixed(0)}% от оборота` : undefined} />
        <StatCard label="Хонорари"       value={`€${totalPayments.toFixed(0)}`}     accent="text-orange-400" />
        <StatCard label="Печалба"        value={`€${totalProfit.toFixed(0)}`}       accent="text-emerald-400"
          sub={totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(0)}% марж` : undefined} />
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden">

        {/* Header */}
        <div
          className="grid gap-x-2 px-4 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold tracking-widest uppercase text-white/35"
          style={{ gridTemplateColumns: COL }}
        >
          <div>Месец</div>
          <div className="text-right">Посещения</div>
          <div className="text-right">В брой</div>
          <div className="text-right">Абон.</div>
          <div className="text-right text-sky-400/70">Мулти.</div>
          <div className="text-right text-indigo-400/70">Куулфит</div>
          <div className="text-right text-sky-400/70">Мулти. €</div>
          <div className="text-right text-indigo-400/70">Куулфит €</div>
          <div className="text-right text-violet-400/70">Оборот</div>
          <div className="text-right text-emerald-400/70">Печалба</div>
          <div>Статус</div>
        </div>

        {/* Rows */}
        {yearlyData.map((row) => (
          <div
            key={row.month}
            onClick={() => onSelectMonth(row.month)}
            className="grid gap-x-2 px-4 py-3 border-b border-white/[0.04] last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors items-center group"
            style={{ gridTemplateColumns: COL }}
          >
            <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
              {monthLabel(row.month)}
            </div>
            <div className="text-right text-sm text-white/90 tabular-nums">{Number(row.total_visits).toLocaleString()}</div>
            <div className="text-right text-sm text-white/50 tabular-nums">{Number(row.visits_cash)}</div>
            <div className="text-right text-sm text-white/50 tabular-nums">{Number(row.visits_subscription)}</div>
            <div className="text-right text-sm text-sky-300/80 tabular-nums">{Number(row.visits_multisport)}</div>
            <div className="text-right text-sm text-indigo-300/80 tabular-nums">{Number(row.visits_coolfit)}</div>
            <div className="text-right text-sm text-sky-400 tabular-nums font-medium">
              {Number(row.revenue_multisport) > 0 ? `€${Number(row.revenue_multisport).toFixed(0)}` : <span className="text-white/20">—</span>}
            </div>
            <div className="text-right text-sm text-indigo-400 tabular-nums font-medium">
              {Number(row.revenue_coolfit) > 0 ? `€${Number(row.revenue_coolfit).toFixed(0)}` : <span className="text-white/20">—</span>}
            </div>
            <div className="text-right text-sm text-violet-400 font-semibold tabular-nums">
              €{Number(row.total_revenue).toFixed(0)}
            </div>
            <div className="text-right text-sm text-emerald-400 font-semibold tabular-nums">
              €{Number(row.gym_profit).toFixed(0)}
            </div>
            <div>
              {row.is_locked
                ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400/80 bg-amber-400/[0.08] border border-amber-400/20 px-2 py-0.5 rounded-md">🔒 Заключен</span>
                : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/30 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md">● Отворен</span>
              }
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
