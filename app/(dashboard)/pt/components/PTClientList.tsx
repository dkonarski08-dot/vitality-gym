// app/(dashboard)/pt/components/PTClientList.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { PTClient, Instructor } from '../page'
import PTClientDetail from './PTClientDetail'
import PTClientModal from './PTClientModal'
import PTPackageModal from './PTPackageModal'
import { GOAL_LABELS, getInitials, getActivePkg, getUrgency, sortClients, Urgency } from '../ptConstants'

interface Props {
  clients: PTClient[]
  instructors: Instructor[]
  userRole: string
  onEditClient: (client: PTClient) => void
  onRefresh: () => void
  // Callbacks for modals opened from detail panel
  onAddSessionForClient: (clientId: string, instructorId: string) => void
}

function matchesSearch(client: PTClient, q: string): boolean {
  const lower = q.toLowerCase()
  return (
    client.name.toLowerCase().includes(lower) ||
    (client.phone || '').includes(lower)
  )
}

export default function PTClientList({ clients, instructors, userRole, onEditClient, onRefresh, onAddSessionForClient }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [packageModal, setPackageModal] = useState<{ client: PTClient } | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const filtered = useMemo(() => {
    const list = search.trim() ? clients.filter(c => matchesSearch(c, search)) : clients
    return sortClients(list)
  }, [clients, search])

  // Auto-select first active client; clear selection if selected client no longer exists
  useEffect(() => {
    if (selectedId) {
      if (!clients.find(c => c.id === selectedId)) setSelectedId(null)
      return
    }
    const first = filtered.find(c => c.active)
    if (first) setSelectedId(first.id)
  }, [clients, filtered, selectedId])

  // Stats — memoized, depends only on clients prop
  const { activeCount, expiredCount, expiringCount, inactiveCount } = useMemo(() => ({
    activeCount:   clients.filter(c => c.active).length,
    expiredCount:  clients.filter(c => c.active && getUrgency(c) === 'expired').length,
    expiringCount: clients.filter(c => c.active && getUrgency(c) === 'expiring').length,
    inactiveCount: clients.filter(c => !c.active).length,
  }), [clients])

  // Active and inactive groups for rendering with section labels
  const activeList = filtered.filter(c => c.active)
  const inactiveList = filtered.filter(c => !c.active)
  const urgentList = activeList.filter(c => ['expired', 'low', 'expiring'].includes(getUrgency(c)))
  const normalList = activeList.filter(c => ['ok', 'no_package'].includes(getUrgency(c)))

  function handleAddPackage(client: PTClient) {
    setPackageModal({ client })
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ── Stats bar ── */}
      <div className="flex gap-px bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden mb-4">
        <div className="flex-1 px-4 py-3 bg-white/[0.02]">
          <div className="text-lg font-bold text-emerald-400">{activeCount}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Активни</div>
        </div>
        <div className="flex-1 px-4 py-3 bg-white/[0.02]">
          <div className={`text-lg font-bold ${expiredCount > 0 ? 'text-red-400' : 'text-white/20'}`}>{expiredCount}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Изтекъл пакет</div>
        </div>
        <div className="flex-1 px-4 py-3 bg-white/[0.02]">
          <div className={`text-lg font-bold ${expiringCount > 0 ? 'text-amber-400' : 'text-white/20'}`}>{expiringCount}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Изтичат скоро</div>
        </div>
        <div className="flex-1 px-4 py-3 bg-white/[0.02]">
          <div className="text-lg font-bold text-white/25">{inactiveCount}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Неактивни</div>
        </div>
      </div>

      {/* ── Master-detail layout ── */}
      <div className="flex gap-3 min-h-0" style={{ height: 'calc(100vh - 280px)' }}>

        {/* ── Left panel: client list ── */}
        <div className="w-64 flex-shrink-0 flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Search */}
          <div className="p-2.5 border-b border-white/[0.05]">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Търси по име или телефон..."
                className="w-full h-8 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-amber-400/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-white/25 text-xs">Няма резултати</div>
            )}

            {/* Urgent */}
            {urgentList.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-red-400/60">
                  ⚠ Нуждаят се от внимание
                </div>
                {urgentList.map(client => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    selected={selectedId === client.id}
                    onClick={() => setSelectedId(client.id)}
                  />
                ))}
              </>
            )}

            {/* Normal active */}
            {normalList.length > 0 && (
              <>
                {urgentList.length > 0 && (
                  <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/25">
                    Активни
                  </div>
                )}
                {normalList.map(client => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    selected={selectedId === client.id}
                    onClick={() => setSelectedId(client.id)}
                  />
                ))}
              </>
            )}

            {/* Inactive */}
            {inactiveList.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/20">
                  Неактивни
                </div>
                {inactiveList.map(client => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    selected={selectedId === client.id}
                    onClick={() => setSelectedId(client.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right panel: client detail ── */}
        <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
          {selectedId ? (
            <PTClientDetail
              clientId={selectedId}
              clients={clients}
              instructors={instructors}
              userRole={userRole}
              refreshKey={detailRefreshKey}
              onEditClient={onEditClient}
              onAddSession={onAddSessionForClient}
              onAddPackage={handleAddPackage}
              onRefresh={onRefresh}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/25 text-sm">
              Избери клиент от списъка →
            </div>
          )}
        </div>
      </div>

      {/* ── Package modal (opened from detail panel) ── */}
      {packageModal && (
        <PTPackageModal
          mode="add"
          client={packageModal.client}
          onClose={() => setPackageModal(null)}
          onSaved={async () => { setPackageModal(null); onRefresh(); setDetailRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

// ── Client row sub-component ──
function ClientRow({ client, selected, onClick }: {
  client: PTClient
  selected: boolean
  onClick: () => void
}) {
  const pkg = getActivePkg(client)
  const remaining = pkg ? pkg.total_sessions - pkg.used_sessions : null
  const urgency = getUrgency(client)

  const avatarClass = !client.active
    ? 'bg-white/[0.05] text-white/25'
    : urgency === 'expired'
      ? 'bg-red-500/15 text-red-400'
      : urgency === 'low' || urgency === 'expiring'
        ? 'bg-amber-400/15 text-amber-400'
        : 'bg-emerald-500/15 text-emerald-400'

  const badgeColor = !client.active || remaining === null
    ? 'text-white/20'
    : urgency === 'expired' || remaining === 0
      ? 'text-red-400'
      : urgency === 'low' || urgency === 'expiring'
        ? 'text-amber-400'
        : 'text-emerald-400'

  const rowClass = [
    'flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors border-l-2',
    selected
      ? 'bg-amber-400/[0.06] border-amber-400'
      : urgency === 'expired' && client.active
        ? 'hover:bg-red-500/[0.04] border-red-500/30 bg-red-500/[0.02]'
        : 'hover:bg-white/[0.03] border-transparent',
    !client.active ? 'opacity-40' : '',
  ].join(' ')

  const goalLabel = client.goal ? (GOAL_LABELS[client.goal] ?? client.goal) : null

  return (
    <div className={rowClass} onClick={onClick}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarClass}`}>
        {getInitials(client.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white truncate">{client.name}</div>
        <div className="text-[10px] text-white/35 truncate mt-0.5">
          {urgency === 'expired' && client.active
            ? <span className="text-red-400/70">Изтекъл пакет</span>
            : goalLabel
              ? goalLabel
              : client.instructor?.name}
        </div>
      </div>
      {remaining !== null && (
        <div className={`text-xs font-bold flex-shrink-0 ${badgeColor}`}>
          {remaining}
        </div>
      )}
    </div>
  )
}
