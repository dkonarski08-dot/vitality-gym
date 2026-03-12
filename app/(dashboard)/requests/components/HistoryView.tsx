'use client'

import { DeliveryRequest, RequestStatus } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { RequestModal } from './RequestModal'
import { useState } from 'react'

interface Props {
  requests: DeliveryRequest[]
  statusFilter: string
  userRole: string
  onAddAllToNew: (request: DeliveryRequest) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Чернова',
  submitted: 'Изпратена',
  approved: 'Одобрена',
  rejected: 'Отхвърлена',
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'bg-white/10 text-white/50',
  submitted: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function HistoryView({ requests, statusFilter, userRole, onAddAllToNew, onApprove, onReject }: Props) {
  const [viewRequest, setViewRequest] = useState<DeliveryRequest | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null)

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter)

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-white/40 text-sm">Няма заявки</div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{formatDate(r.created_at)}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {r.created_by} · {r.delivery_request_items.length} продукта
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {userRole === 'admin' && r.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => setConfirmAction({ type: 'approve', id: r.id })}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
                    >
                      Одобри
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'reject', id: r.id })}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
                    >
                      Отхвърли
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewRequest(r)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/10 hover:text-white/70 transition-colors"
                >
                  Преглед
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <RequestModal
        request={viewRequest}
        onClose={() => setViewRequest(null)}
        onAddAllToNew={(req) => { setViewRequest(null); onAddAllToNew(req) }}
      />

      <ConfirmModal
        open={confirmAction?.type === 'approve'}
        title="Одобри заявка"
        message="Сигурен ли си, че искаш да одобриш тази заявка?"
        confirmLabel="Одобри"
        onConfirm={() => { if (confirmAction) { onApprove(confirmAction.id); setConfirmAction(null) } }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmModal
        open={confirmAction?.type === 'reject'}
        title="Отхвърли заявка"
        message="Сигурен ли си, че искаш да отхвърлиш тази заявка?"
        confirmLabel="Отхвърли"
        danger
        onConfirm={() => { if (confirmAction) { onReject(confirmAction.id); setConfirmAction(null) } }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  )
}
