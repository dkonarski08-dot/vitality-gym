// app/(dashboard)/pt/components/PTInstructorBreakdown.tsx
'use client'

interface InstructorStat {
  name: string
  completed: number
  noShows: number
  clients: Set<string>
  revenue: number
}

interface Props {
  instructorStats: InstructorStat[]
}

export default function PTInstructorBreakdown({ instructorStats }: Props) {
  if (instructorStats.length === 0) return null

  const maxRevenue = Math.max(...instructorStats.map(i => i.revenue), 1)

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
      <div className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">По инструктор</div>
      <div className="space-y-3">
        {instructorStats.map(inst => {
          const total = inst.completed + inst.noShows
          const nsRate = total > 0 ? ((inst.noShows / total) * 100).toFixed(0) : '0'
          return (
            <div key={inst.name} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
              <div>
                <div className="text-xs text-white/70 mb-1">{inst.name}</div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(inst.revenue / maxRevenue) * 100}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-emerald-400">€{inst.revenue.toFixed(0)}</div>
                <div className="text-[10px] text-white/30">{inst.clients.size} клиента</div>
              </div>
              {inst.noShows > 0 && (
                <div className="text-[10px] text-red-400/60">{nsRate}% неяв</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
