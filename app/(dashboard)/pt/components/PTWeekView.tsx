// app/(dashboard)/pt/components/PTWeekView.tsx
'use client'

import { PTSession, Instructor } from '../page'

interface Props {
  weekStart: Date
  sessions: PTSession[]
  instructors: Instructor[]
  selectedInstructor: string
  userRole: string
  onAddSession: (date: string, time: string, instructorId?: string) => void
  onEditSession: (session: PTSession) => void
  onRefresh: () => void
}

const DAYS_BG = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS_BG_SHORT = ['яну','фев','мар','апр','май','юни','юли','авг','сеп','окт','ное','дек']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 07:00 – 21:00

const STATUS_COLORS: Record<string, string> = {
  scheduled:        'bg-amber-500/15 border-amber-500/30 text-amber-300',
  completed:        'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  cancelled_early:  'bg-white/5 border-white/10 text-white/40 line-through',
  cancelled_late:   'bg-red-500/10 border-red-500/20 text-red-400/60 line-through',
  no_show:          'bg-red-500/15 border-red-500/30 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Планирана',
  completed: 'Проведена',
  cancelled_early: 'Отменена',
  cancelled_late: 'Отменена (кратко)',
  no_show: 'Неявяване',
}

const TYPE_ICONS: Record<string, string> = {
  personal: '👤',
  pair: '👥',
  online: '💻',
}

export default function PTWeekView({ weekStart, sessions, instructors, selectedInstructor, userRole, onAddSession, onEditSession, onRefresh }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // Build 7 days of the week
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  // Group sessions by day and hour slot
  const getSessionsForSlot = (day: Date, hour: number) => {
    const dateStr = day.toISOString().split('T')[0]
    return sessions.filter(s => {
      const d = new Date(s.scheduled_at)
      return d.toISOString().split('T')[0] === dateStr && d.getHours() === hour
    })
  }

  // Sessions per day (for day header count)
  const getSessionsForDay = (day: Date) => {
    const dateStr = day.toISOString().split('T')[0]
    return sessions.filter(s => new Date(s.scheduled_at).toISOString().split('T')[0] === dateStr)
  }

  const handleSlotClick = (day: Date, hour: number) => {
    if (userRole === 'instructor') return // handled via add button
    const dateStr = day.toISOString().split('T')[0]
    const timeStr = `${String(hour).padStart(2, '0')}:00`
    onAddSession(dateStr, timeStr, selectedInstructor !== 'all' ? selectedInstructor : undefined)
  }

  return (
    <div className="space-y-4">
      {/* Mobile week label */}
      <div className="sm:hidden text-center text-xs text-white/50">
        {weekStart.getDate()} – {new Date(weekStart.getTime() + 6 * 86400000).getDate()} {MONTHS_BG_SHORT[new Date(weekStart.getTime() + 6 * 86400000).getMonth()]}
      </div>

      {/* Grid */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid border-b border-white/[0.06]" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div className="py-3" />
            {days.map((day, i) => {
              const dateStr = day.toISOString().split('T')[0]
              const isToday = dateStr === today
              const isWeekend = i >= 5
              const count = getSessionsForDay(day).length
              return (
                <div key={dateStr} className={`py-2 px-1 text-center border-l border-white/[0.04] ${isToday ? 'bg-amber-500/[0.04]' : ''}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${isWeekend ? 'text-white/30' : 'text-white/40'}`}>{DAYS_BG[i]}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-amber-400' : isWeekend ? 'text-white/40' : 'text-white'}`}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="mt-1 flex justify-center">
                      <span className="text-[9px] bg-amber-400/10 text-amber-400 rounded-full px-1.5 py-0.5">{count}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="grid border-b border-white/[0.03]" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
              {/* Time label */}
              <div className="py-2 pr-2 text-right">
                <span className="text-[10px] text-white/25">{String(hour).padStart(2,'0')}:00</span>
              </div>
              {/* Day cells */}
              {days.map((day, i) => {
                const dateStr = day.toISOString().split('T')[0]
                const isToday = dateStr === today
                const slotSessions = getSessionsForSlot(day, hour)
                const isPast = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:59:59`) < new Date()
                return (
                  <div
                    key={dateStr}
                    onClick={() => slotSessions.length === 0 && !isPast && handleSlotClick(day, hour)}
                    className={`min-h-[52px] border-l border-white/[0.04] p-0.5 transition-colors
                      ${isToday ? 'bg-amber-500/[0.02]' : ''}
                      ${slotSessions.length === 0 && !isPast && userRole !== 'instructor' ? 'cursor-pointer hover:bg-white/[0.03]' : ''}
                    `}>
                    {slotSessions.map(session => {
                      const startTime = new Date(session.scheduled_at)
                      const endMin = startTime.getMinutes() + session.duration_minutes
                      const endH = startTime.getHours() + Math.floor(endMin / 60)
                      const endM = endMin % 60
                      return (
                        <div
                          key={session.id}
                          onClick={e => { e.stopPropagation(); onEditSession(session) }}
                          className={`rounded border px-1 py-0.5 mb-0.5 cursor-pointer hover:brightness-125 transition-all ${STATUS_COLORS[session.status]}`}>
                          <div className="text-[9px] font-medium leading-tight truncate">
                            {TYPE_ICONS[session.session_type]} {session.client?.name}
                          </div>
                          <div className="text-[8px] opacity-60">
                            {String(startTime.getHours()).padStart(2,'0')}:{String(startTime.getMinutes()).padStart(2,'0')}–{String(endH).padStart(2,'0')}:{String(endM).padStart(2,'0')}
                          </div>
                          {selectedInstructor === 'all' && session.instructor && (
                            <div className="text-[8px] opacity-50 truncate">{session.instructor.name}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day summary — today's sessions */}
      {(() => {
        const todaySessions = sessions.filter(s => new Date(s.scheduled_at).toISOString().split('T')[0] === today)
        if (todaySessions.length === 0) return null
        return (
          <div className="bg-amber-400/[0.03] border border-amber-400/10 rounded-xl p-4">
            <div className="text-xs font-semibold text-amber-400 mb-3">📅 Днес</div>
            <div className="space-y-2">
              {todaySessions.map(s => {
                const t = new Date(s.scheduled_at)
                return (
                  <div key={s.id} onClick={() => onEditSession(s)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors">
                    <span className="text-xs text-white/50 w-11 shrink-0">
                      {String(t.getHours()).padStart(2,'0')}:{String(t.getMinutes()).padStart(2,'0')}
                    </span>
                    <span className="text-xs text-white font-medium">{s.client?.name}</span>
                    {selectedInstructor === 'all' && <span className="text-[10px] text-white/40">{s.instructor?.name}</span>}
                    <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
