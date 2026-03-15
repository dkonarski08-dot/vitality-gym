// app/(dashboard)/pt/components/PTMonthlyTable.tsx
'use client'

const MONTH_NAMES_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

interface MonthlySummary {
  month: string
  inquiries: number
  won: number
  lost: number
  revenue: number
}

interface Props {
  monthlySummary: MonthlySummary[]
  viewYear: number
  viewMonth: number // 0-based, only rendered when viewMonth !== null
}

export default function PTMonthlyTable({ monthlySummary, viewYear, viewMonth }: Props) {
  if (monthlySummary.length === 0) return null

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Последни 6 месеца</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {['Месец', 'Запитвания', 'Спечелени', 'Конв.', 'Приходи'].map(h => (
              <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...monthlySummary].reverse().slice(0, 6).map(row => {
            const [y, m] = row.month.split('-').map(Number)
            const isCurrent = y === viewYear && (m - 1) === viewMonth
            const rowClosed = row.won + row.lost
            const rowConv = rowClosed > 0 ? Math.round((row.won / rowClosed) * 100) : 0
            return (
              <tr key={row.month} className={`border-b border-white/[0.04] last:border-0 ${isCurrent ? '' : 'opacity-60'}`}>
                <td className={`px-4 py-2.5 text-xs ${isCurrent ? 'text-white font-semibold' : 'text-white/70'}`}>
                  {MONTH_NAMES_BG[m - 1].slice(0, 3)} {y}
                </td>
                <td className="px-4 py-2.5 text-xs text-white/60">{row.inquiries}</td>
                <td className="px-4 py-2.5 text-xs font-semibold text-emerald-400">{row.won}</td>
                <td className="px-4 py-2.5 text-xs font-semibold text-amber-400">{rowConv}%</td>
                <td className="px-4 py-2.5 text-xs text-emerald-400">€{row.revenue.toFixed(0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
