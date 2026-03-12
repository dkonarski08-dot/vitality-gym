import { DeliveryRequest, RequestStatus } from '../types'

interface Props {
  request: DeliveryRequest | null
  onClose: () => void
  onAddAllToNew: (request: DeliveryRequest) => void
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

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  const months = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']
  return `${months[parseInt(m) - 1]} ${year}`
}

export function RequestModal({ request, onClose, onAddAllToNew }: Props) {
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">{formatMonth(request.month)}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {request.created_by} · {request.delivery_request_items.length} продукта
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg">✕</button>
        </div>

        {/* AI suggestions */}
        {request.ai_suggestions && (
          <div className="mx-6 mt-4 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-3 text-xs text-amber-400/80">
            🤖 {request.ai_suggestions}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {request.delivery_request_items.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
              <span className="text-sm text-white/80">{item.product_name}</span>
              <span className="text-sm text-white/40 shrink-0 ml-4">{item.quantity} {item.unit}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="mx-6 mb-4 bg-white/[0.02] rounded-lg px-3 py-2 text-xs text-white/50">
            {request.notes}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => onAddAllToNew(request)}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
          >
            📋 Добави всичко към нова заявка
          </button>
        </div>
      </div>
    </div>
  )
}
