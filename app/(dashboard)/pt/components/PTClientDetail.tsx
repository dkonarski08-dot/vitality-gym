// app/(dashboard)/pt/components/PTClientDetail.tsx
'use client'

import { useState, useEffect } from 'react'
import { PTClient, PTPackage, PTSession, Instructor } from '../page'
import { GOAL_LABELS, DAY_LABELS, TIME_SLOT_LABELS, getInitials } from '../ptConstants'
import PTSessionHistory from './PTSessionHistory'
import PTPackageHistory from './PTPackageHistory'

interface Props {
  clientId: string
  clients: PTClient[]
  instructors: Instructor[]
  userRole: string
  refreshKey?: number
  onEditClient: (client: PTClient) => void
  onAddSession: (clientId: string, instructorId: string) => void
  onAddPackage: (client: PTClient) => void
  onRefresh: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  facebook:  '📘 Фейсбук',
  instagram: '📸 Инстаграм',
  google:    '🔍 Гугъл',
  friend:    '👥 Приятел',
  nearby:    '📍 Наблизо',
}

function formatDateBG(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}


function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function PTClientDetail({
  clientId, clients, instructors, userRole, refreshKey,
  onEditClient, onAddSession, onAddPackage, onRefresh,
}: Props) {
  const [detail, setDetail] = useState<{ client: PTClient; sessions: PTSession[]; packages: PTPackage[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setDetail(null)
    fetch(`/api/pt?client_id=${clientId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!data.client) throw new Error('not found')
        setDetail({
          client: data.client,
          sessions: data.sessions || [],
          packages: data.packages || [],
        })
        setLoading(false)
      })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false) })
    return () => controller.abort()
  }, [clientId, refreshKey])

  async function handleToggleActive(client: PTClient) {
    setActionLoading(true)
    await fetch('/api/pt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_client', client_id: client.id, active: !client.active }),
    })
    setActionLoading(false)
    onRefresh()
  }

  async function handleDelete(client: PTClient) {
    setActionLoading(true)
    await fetch(`/api/pt?client_id=${client.id}`, { method: 'DELETE' })
    setActionLoading(false)
    setConfirmDelete(false)
    onRefresh()
  }

  // Optimistic: show name from list while loading
  const listClient = clients.find(c => c.id === clientId)
  const displayName = detail?.client.name ?? listClient?.name ?? '...'
  const displayInstructor = detail?.client.instructor?.name ?? listClient?.instructor?.name ?? ''

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        Грешка при зареждане
      </div>
    )
  }

  const { client, sessions, packages } = detail
  const activePkg = packages.find(p => p.active)
  const otherPkgs = packages.filter(p => !p.active)

  const remaining = activePkg ? activePkg.total_sessions - activePkg.used_sessions : null
  const isExpired = activePkg?.expires_at ? new Date(activePkg.expires_at) < new Date() : false
  const isExpiringSoon = !isExpired && activePkg?.expires_at
    ? daysUntil(activePkg.expires_at) <= 7
    : false
  const isLow = remaining !== null && remaining <= 2

  // Package health for progress bar: remaining / total
  const pkgHealth = activePkg && activePkg.total_sessions > 0
    ? Math.max(0, ((activePkg.total_sessions - activePkg.used_sessions) / activePkg.total_sessions) * 100)
    : 0

  const pkgBarColor = isExpired || remaining === 0
    ? 'bg-red-400'
    : isLow || isExpiringSoon
      ? 'bg-amber-400'
      : 'bg-emerald-400'

  const pkgBoxClass = isExpired
    ? 'bg-red-500/[0.06] border border-red-500/20'
    : isExpiringSoon || isLow
      ? 'bg-amber-400/[0.06] border border-amber-400/20'
      : 'bg-emerald-500/[0.06] border border-emerald-500/15'

  const timeSlots = (client.preferred_time_slot || '').split(',').map(s => s.trim()).filter(Boolean)

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          !client.active
            ? 'bg-white/[0.06] text-white/30'
            : isExpired
              ? 'bg-red-500/15 text-red-400'
              : 'bg-emerald-500/15 text-emerald-400'
        }`}>
          {getInitials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white">{client.name}</h2>
            {!client.active && (
              <span className="text-[10px] border border-white/10 text-white/30 rounded px-1.5 py-0.5">неактивен</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
            {displayInstructor && <span>💪 {displayInstructor}</span>}
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span>✉️ {client.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={() => onAddSession(client.id, client.instructor_id)}
            className="px-3 h-8 rounded-lg text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 transition-colors">
            + Тренировка
          </button>
          <button
            onClick={() => onAddPackage(client)}
            className="px-3 h-8 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
            + Пакет
          </button>
          <button
            onClick={() => onEditClient(client)}
            className="px-3 h-8 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white transition-colors">
            Редактирай
          </button>
          {userRole === 'admin' && (
            <>
              <button
                onClick={() => handleToggleActive(client)}
                disabled={actionLoading}
                className="px-3 h-8 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white transition-colors disabled:opacity-40">
                {client.active ? 'Деактивирай' : 'Активирай'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={actionLoading || confirmDelete}
                className="px-3 h-8 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition-colors disabled:opacity-40">
                Изтрий
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="rounded-xl bg-red-500/[0.08] border border-red-500/25 p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-400">Изтриване на клиент</div>
            <div className="text-xs text-white/50 mt-0.5">
              Всички тренировки и пакети на <span className="text-white/70 font-medium">{client.name}</span> ще бъдат изтрити. Действието е необратимо.
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={actionLoading}
              className="px-3 h-8 rounded-lg text-xs text-white/50 bg-white/5 border border-white/[0.08] hover:text-white transition-colors disabled:opacity-40">
              Отказ
            </button>
            <button
              onClick={() => handleDelete(client)}
              disabled={actionLoading}
              className="px-3 h-8 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-40">
              {actionLoading ? '...' : 'Потвърди изтриването'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Package ── */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">Активен пакет</div>
        {activePkg ? (
          <div className={`rounded-xl p-4 ${pkgBoxClass}`}>
            <div className="flex items-end gap-3 mb-3">
              <div>
                <div className={`text-3xl font-black leading-none ${
                  remaining === 0 || isExpired ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {remaining}
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  сесии оставащи от {activePkg.total_sessions}
                </div>
              </div>
              <div className="ml-auto text-right space-y-1">
                {isExpired && (
                  <div className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-0.5">
                    ⏰ Изтекъл · {formatDateBG(activePkg.expires_at!)}
                  </div>
                )}
                {isExpiringSoon && !isExpired && (
                  <div className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-2 py-0.5">
                    ⚠ Изтича за {daysUntil(activePkg.expires_at!)} дни
                  </div>
                )}
                {!isExpired && !isExpiringSoon && activePkg.expires_at && (
                  <div className="text-[10px] text-white/30">
                    Изтича: {formatDateBG(activePkg.expires_at)}
                  </div>
                )}
                {activePkg.price_total != null && (
                  <div className="text-[11px] text-white/30">€{activePkg.price_total}</div>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pkgBarColor}`} style={{ width: `${pkgHealth}%` }} />
            </div>
            {activePkg.purchased_at && (
              <div className="text-[10px] text-white/20 mt-1.5">
                Закупен: {formatDateBG(activePkg.purchased_at)}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-white/[0.1] rounded-xl p-4 text-center">
            <div className="text-sm text-white/25 mb-3">Без активен пакет</div>
            <button
              onClick={() => onAddPackage(client)}
              className="px-4 h-8 rounded-lg text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/15 transition-colors">
              + Добави пакет
            </button>
          </div>
        )}
      </div>

      {/* ── Profile: goal, source, preferences ── */}
      {(client.goal || client.source || (client.preferred_days?.length ?? 0) > 0 || timeSlots.length > 0 || client.health_notes) && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">Профил</div>
          <div className="flex flex-wrap gap-2">
            {client.goal && (
              <span className="px-2.5 py-1 rounded-lg text-xs bg-violet-400/10 border border-violet-400/20 text-violet-300">
                {GOAL_LABELS[client.goal] ?? client.goal}
              </span>
            )}
            {client.source && (
              <span className="px-2.5 py-1 rounded-lg text-xs bg-sky-400/10 border border-sky-400/20 text-sky-300">
                {SOURCE_LABELS[client.source] ?? client.source}
              </span>
            )}
            {(client.preferred_days ?? []).map(d => (
              <span key={d} className="px-2 py-0.5 rounded text-[11px] bg-amber-400/10 border border-amber-400/20 text-amber-400">
                {DAY_LABELS[d] ?? d}
              </span>
            ))}
            {timeSlots.map(t => (
              <span key={t} className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.05] border border-white/10 text-white/50">
                {TIME_SLOT_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          {client.health_notes && (
            <div className="mt-2 text-xs text-white/40 italic bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
              🩺 {client.health_notes}
            </div>
          )}
        </div>
      )}

      {/* ── Recent Sessions ── */}
      <PTSessionHistory sessions={sessions} />

      {/* ── Package History ── */}
      <PTPackageHistory packages={otherPkgs} />

    </div>
  )
}
