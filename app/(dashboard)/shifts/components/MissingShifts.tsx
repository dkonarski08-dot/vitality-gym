// app/(dashboard)/shifts/components/MissingShifts.tsx
import { MONTHS_BG, DAYS_BG_SHORT as DAYS_BG } from '@/lib/formatters'
import { MissingDay } from '../hooks/useShifts'

interface Props {
  missingByDate: MissingDay[]
}

export function MissingShifts({ missingByDate }: Props) {
  if (missingByDate.length === 0) return null

  return (
    <div className="mt-6 bg-white/[0.02] border border-orange-500/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-orange-500/20 flex items-center gap-2">
        <span className="text-base">⚠️</span>
        <span className="text-xs font-semibold text-orange-300">Дни с липсващи смени</span>
        <span className="text-[10px] text-orange-400/60 ml-auto">
          {missingByDate.length} {missingByDate.length === 1 ? 'ден' : 'дни'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {missingByDate.map(({ date, day }) => {
          const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
          return (
            <div key={date} className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-orange-400/60 font-mono">{DAYS_BG[dowIdx]}</span>
              <span className="text-xs font-medium text-orange-300">{day.getDate()} {MONTHS_BG[day.getMonth()].slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
