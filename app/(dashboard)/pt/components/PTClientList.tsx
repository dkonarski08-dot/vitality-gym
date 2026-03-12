// app/(dashboard)/pt/components/PTClientList.tsx
'use client'

import { useState } from 'react'
import { PTClient, Instructor } from '../page'

interface Props {
  clients: PTClient[]
  instructors: Instructor[]
  userRole: string
  onEditClient: (client: PTClient) => void
  onRefresh: () => void
}

export default function PTClientList({ clients, instructors, userRole, onEditClient }: Props) {
  const [search, setSearch] = useState('')
  const [filterInstructor, setFilterInstructor] = useState('all')

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    const matchInstructor = filterInstructor === 'all' || c.instructor_id === filterInstructor
    return matchSearch && matchInstructor
  })

  const activeCount = clients.filter(c => c.active).length
  const lowPackageCount = clients.filter(c => {
    const pkg = c.packages?.find(p => p.active)
    return pkg && (pkg.total_sessions - pkg.used_sessions) <= 2
  }).length

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
          <span className="text-white/50">Активни клиенти </span>
          <span className="text-white font-semibold">{activeCount}</span>
        </div>
        {lowPackageCount > 0 && (
          <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            ⚠️ {lowPackageCount} клиента с малко сесии
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Търси клиент..."
          className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/50" />
        {userRole !== 'instructor' && instructors.length > 1 && (
          <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white/5 border border-white/[0.08] text-white text-xs focus:outline-none">
            <option value="all">Всички</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
      </div>

      {/* Client grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">Няма клиенти</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(client => {
            const pkg = client.packages?.find(p => p.active)
            const remaining = pkg ? pkg.total_sessions - pkg.used_sessions : null
            const isLow = remaining !== null && remaining <= 2
            const isExpiringSoon = pkg?.expires_at && new Date(pkg.expires_at) < new Date(Date.now() + 14 * 86400000)

            return (
              <div key={client.id} onClick={() => onEditClient(client)}
                className={`bg-white/[0.02] border rounded-xl p-4 cursor-pointer hover:border-white/[0.15] transition-all ${
                  !client.active ? 'opacity-40' : isLow ? 'border-red-500/20' : 'border-white/[0.06]'
                }`}>
                {/* Name & instructor */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{client.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{client.instructor?.name}</div>
                  </div>
                  {!client.active && <span className="text-[9px] text-white/30 border border-white/10 rounded px-1">неактивен</span>}
                </div>

                {/* Goal */}
                {client.goal && (
                  <div className="text-[11px] text-white/50 mb-2 truncate">🎯 {client.goal}</div>
                )}

                {/* Package status */}
                <div className="mt-auto">
                  {pkg ? (
                    <div className="space-y-1">
                      {/* Progress bar */}
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-white/40">Пакет</span>
                        <span className={isLow ? 'text-red-400 font-semibold' : 'text-white/60'}>
                          {remaining} / {pkg.total_sessions}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isLow ? 'bg-red-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.max(0, (pkg.used_sessions / pkg.total_sessions) * 100)}%` }} />
                      </div>
                      {isLow && <div className="text-[10px] text-red-400">⚠️ Препоръчай подновяване</div>}
                      {isExpiringSoon && !isLow && (
                        <div className="text-[10px] text-amber-400/70">
                          ⏰ Изтича {new Date(pkg.expires_at!).toLocaleDateString('bg-BG')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-white/25 border border-dashed border-white/10 rounded-lg px-2 py-1 text-center">
                      Без активен пакет
                    </div>
                  )}
                </div>

                {/* Phone */}
                {client.phone && (
                  <div className="text-[10px] text-white/30 mt-2">{client.phone}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
