// components/shifts/ReceptionistWeekView.tsx
'use client'

import { useMemo } from 'react'
import { DAYS_BG_SHORT } from '@/lib/formatters'
import { Staff, Shift, LEAVE_TYPES, roleLeftBorder } from '@/app/(dashboard)/shifts/utils'

interface Props {
  staff: Staff[]
  shifts: Shift[]
  year: number
  month: number
  days: Date[]
  today: string
}

const LEAVE_TYPE_SET = new Set(LEAVE_TYPES.map(l => l.type))
const VISIBLE_ROLES = new Set(['Reception', 'instructor'])

function shiftHours(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}ч` : `${h}ч${m}м`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns Mon–Sun week arrays covering the month. Days outside the month are included as padding. */
function getWeeks(days: Date[]): Date[][] {
  if (days.length === 0) return []
  const first = days[0]
  const dow = first.getDay() === 0 ? 7 : first.getDay() // 1=Mon … 7=Sun
  const monday = new Date(first)
  monday.setDate(first.getDate() - (dow - 1))
  const last = days[days.length - 1]
  const weeks: Date[][] = []
  let ws = new Date(monday)
  while (ws <= last) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws)
      d.setDate(ws.getDate() + i)
      week.push(d)
    }
    weeks.push(week)
    ws = new Date(ws)
    ws.setDate(ws.getDate() + 7)
  }
  return weeks
}

export function ReceptionistWeekView({ staff, shifts, year, month, days, today }: Props) {
  const weeks = getWeeks(days)
  const visibleStaff = useMemo(() => staff.filter(s => VISIBLE_ROLES.has(s.role)), [staff])
  const staffById = useMemo(() => new Map(visibleStaff.map(s => [s.id, s])), [visibleStaff])

  // Build per-date shift list: exclude leave types, only visible roles, sort by start_time ascending
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of shifts) {
      if (LEAVE_TYPE_SET.has(shift.shift_type)) continue
      if (!staffById.has(shift.staff_id)) continue
      map.set(shift.date, [...(map.get(shift.date) ?? []), shift])
    }
    for (const [date, dayShifts] of map) {
      map.set(date, [...dayShifts].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    }
    return map
  }, [shifts, staffById])

  return (
    <div className="space-y-3">
      {weeks.map((week, wi) => (
        <div key={wi} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">

          {/* Week header — day name + date number */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {week.map((day, di) => {
              const dateStr = toDateStr(day)
              const isCurrentMonth = day.getMonth() + 1 === month && day.getFullYear() === year
              const isToday = dateStr === today
              const dowIdx = day.getDay() === 0 ? 6 : day.getDay() - 1
              return (
                <div
                  key={di}
                  className={`px-3 py-2 text-center ${isToday ? 'bg-amber-400/10' : ''} ${di < 6 ? 'border-r border-white/[0.04]' : ''}`}
                >
                  <div className={`text-[9px] uppercase tracking-wider ${isCurrentMonth ? 'text-white/40' : 'text-white/15'}`}>
                    {DAYS_BG_SHORT[dowIdx]}
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-amber-400' : isCurrentMonth ? 'text-white/80' : 'text-white/20'}`}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Shift pills per day */}
          <div className="grid grid-cols-7 min-h-[60px]">
            {week.map((day, di) => {
              const dateStr = toDateStr(day)
              const isCurrentMonth = day.getMonth() + 1 === month && day.getFullYear() === year
              const isToday = dateStr === today
              const dayShifts = isCurrentMonth ? (shiftsByDate.get(dateStr) ?? []) : []
              return (
                <div
                  key={di}
                  className={`p-2 space-y-1.5 ${isToday ? 'bg-amber-400/[0.04]' : ''} ${di < 6 ? 'border-r border-white/[0.04]' : ''}`}
                >
                  {dayShifts.map(shift => {
                    const member = staffById.get(shift.staff_id)
                    if (!member) return null
                    return (
                      <div
                        key={shift.id}
                        className={`px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] border-l-2 ${roleLeftBorder(member.role)}`}
                      >
                        <div className="text-[11px] font-medium text-white truncate">{member.name}</div>
                        <div className="text-[10px] text-white/60 flex items-center gap-1.5">
                          <span>{shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}</span>
                          <span className="text-white/35">{shiftHours(shift.start_time, shift.end_time)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

        </div>
      ))}
    </div>
  )
}
