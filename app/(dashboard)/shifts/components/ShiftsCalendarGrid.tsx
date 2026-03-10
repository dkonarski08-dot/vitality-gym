// app/(dashboard)/shifts/components/ShiftsCalendarGrid.tsx
import { DAYS_BG_SHORT as DAYS_BG } from '@/lib/formatters'
import { Staff, Shift, Holiday, getShiftDisplay } from '../utils'

interface Props {
  staff: Staff[]
  days: Date[]
  year: number
  month: number
  today: string
  userRole: string
  editCell: { staffId: string; date: string } | null
  getShift: (staffId: string, date: string) => Shift | undefined
  getHoliday: (date: string) => Holiday | undefined
  onCellClick: (staffId: string, date: string) => void
}

function roleGradient(role: string) {
  if (role === 'admin') return 'from-amber-400 to-orange-500'
  if (role === 'instructor') return 'from-emerald-400 to-green-500'
  if (role === 'cleaning') return 'from-purple-400 to-violet-500'
  return 'from-sky-400 to-blue-500'
}

function toDateStr(year: number, month: number, day: Date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

export function ShiftsCalendarGrid({
  staff, days, year, month, today, userRole, editCell, getShift, getHoliday, onCellClick,
}: Props) {
  const cols = `140px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid gap-px bg-white/[0.04]" style={{ gridTemplateColumns: cols }}>
          <div className="bg-[#060609] px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider">Служител</div>
          {days.map(day => {
            const dateStr = toDateStr(year, month, day)
            const isToday = dateStr === today
            const isWeekend = day.getDay() === 0 || day.getDay() === 6
            const holiday = getHoliday(dateStr)
            const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
            return (
              <div key={dateStr}
                className={`bg-[#060609] px-0.5 py-1.5 text-center ${isToday ? 'bg-amber-500/5' : ''} ${holiday ? 'bg-red-500/10' : ''}`}
                title={holiday?.name || ''}>
                <div className={`text-[8px] uppercase tracking-wider ${isWeekend || holiday ? 'text-red-400/60' : 'text-white/30'}`}>{DAYS_BG[dowIdx]}</div>
                <div className={`text-[11px] font-semibold mt-0.5 ${isToday ? 'text-amber-400' : isWeekend || holiday ? 'text-red-400/80' : 'text-white/70'}`}>{day.getDate()}</div>
                {holiday && <div className="mt-0.5 flex justify-center"><div className="w-1 h-1 rounded-full bg-red-400/70" /></div>}
              </div>
            )
          })}
        </div>

        {/* Staff rows */}
        {staff.map(s => (
          <div key={s.id} className="grid gap-px" style={{ gridTemplateColumns: cols }}>
            <div className="bg-[#0a0a0f] px-3 py-2 flex items-center gap-2 border-t border-white/[0.04]">
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleGradient(s.role)} flex items-center justify-center text-[9px] font-bold text-[#0a0a0f] shrink-0`}>
                {s.name.charAt(0)}
              </div>
              <span className="text-xs font-medium text-white/80 truncate">{s.name}</span>
            </div>
            {days.map(day => {
              const dateStr = toDateStr(year, month, day)
              const shift = getShift(s.id, dateStr)
              const isToday = dateStr === today
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const holiday = getHoliday(dateStr)
              const display = shift ? getShiftDisplay(shift) : null
              const isEditing = editCell?.staffId === s.id && editCell?.date === dateStr
              return (
                <div key={dateStr} onClick={() => onCellClick(s.id, dateStr)}
                  className={`relative border-t border-white/[0.04] min-h-[44px] flex items-center justify-center px-0.5 transition-all
                    ${isToday ? 'bg-amber-500/[0.03]' : holiday ? 'bg-red-500/[0.05]' : isWeekend ? 'bg-white/[0.01]' : 'bg-[#0a0a0f]'}
                    ${userRole === 'admin' ? 'cursor-pointer hover:bg-white/[0.04]' : ''}
                    ${isEditing ? 'ring-1 ring-amber-400/50' : ''}`}>
                  {holiday && <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500/30" />}
                  {display && (
                    <div className={`text-center px-0.5 py-0.5 rounded border ${display.color} w-full`}>
                      <div className="text-[8px] font-medium leading-tight">{display.text}</div>
                      {display.sub && <div className="text-[7px] opacity-60">{display.sub}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
