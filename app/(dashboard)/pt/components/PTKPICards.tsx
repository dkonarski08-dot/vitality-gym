// app/(dashboard)/pt/components/PTKPICards.tsx
'use client'

interface KPICardData {
  label: string
  value: string | number
  sub: string
  color: string
  trend: string | null
  trendUp: boolean
}

interface Props {
  cards: KPICardData[]
}

export default function PTKPICards({ cards }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(kpi => (
        <div key={kpi.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{kpi.label}</div>
          <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          <div className="text-[11px] text-white/30 mt-0.5">{kpi.sub}</div>
          {kpi.trend && (
            <div className={`text-[10px] font-semibold mt-1 ${kpi.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {kpi.trend}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
