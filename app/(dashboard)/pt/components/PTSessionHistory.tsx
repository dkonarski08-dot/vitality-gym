// app/(dashboard)/pt/components/PTSessionHistory.tsx
'use client'

import { PTSession } from '../page'

interface Props {
  sessions: PTSession[]
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:       'bg-amber-500/10 border-amber-500/20 text-amber-300',
  completed:       'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  cancelled_early: 'bg-white/5 border-white/10 text-white/40',
  cancelled_late:  'bg-red-500/10 border-red-500/20 text-red-400/70',
  no_show:         'bg-red-500/10 border-red-500/20 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled:       'Планирана',
  completed:       'Проведена',
  cancelled_early: 'Отменена',
  cancelled_late:  'Отменена кратко',
  no_show:         'Неявяване',
}

function formatDateBG(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function formatDateTimeBG(iso: string): string {
  const d = new Date(iso)
  return `${formatDateBG(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PTSessionHistory({ sessions }: Props) {
  const recentSessions = sessions.slice(0, 10)
  const hasMoreSessions = sessions.length > 10

  if (recentSessions.length === 0) return null

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
        Последни сесии
      </div>
      <div className="space-y-1.5">
        {recentSessions.map(s => (
          <div key={s.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors">
            <span className="text-xs text-white/40 w-32 shrink-0">
              {formatDateTimeBG(s.scheduled_at)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_COLORS[s.status]}`}>
              {STATUS_LABELS[s.status]}
            </span>
            <span className="text-[10px] text-white/25 ml-auto">{s.duration_minutes} мин</span>
          </div>
        ))}
        {hasMoreSessions && (
          <div className="text-[10px] text-white/30 text-center pt-1">
            + още {sessions.length - 10} сесии
          </div>
        )}
      </div>
    </div>
  )
}
