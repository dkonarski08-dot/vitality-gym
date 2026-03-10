// app/(dashboard)/requests/components/PastRequests.tsx
import { DeliveryRequest } from '../types'

interface Props {
  pastRequests: DeliveryRequest[]
  selectedRequest: string | null
  setSelectedRequest: (id: string | null) => void
  userRole: string
  onAddMultiple: (items: { product_name: string; unit: string; product_id: string | null }[]) => void
  onDelete: (id: string) => void
}

export function PastRequests({
  pastRequests, selectedRequest, setSelectedRequest, userRole, onAddMultiple, onDelete,
}: Props) {
  if (pastRequests.length === 0) return null

  return (
    <div>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-3">Предишни заявки</div>
      <div className="space-y-2">
        {pastRequests.map(r => (
          <div key={r.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div onClick={() => setSelectedRequest(selectedRequest === r.id ? null : r.id)} className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    r.status === 'submitted' ? 'bg-amber-500/15 text-amber-400' :
                    r.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                    r.status === 'delivered' ? 'bg-sky-500/15 text-sky-400' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {r.status === 'submitted' ? 'Изпратена' :
                     r.status === 'approved' ? 'Одобрена' :
                     r.status === 'delivered' ? 'Доставена' : r.status}
                  </span>
                  <span className="text-xs text-white/40">{r.created_by}</span>
                </div>
                <span className="text-xs text-white/30">{new Date(r.created_at).toLocaleDateString('bg-BG')}</span>
              </div>
              <div className="text-xs text-white/50 mt-1">{r.delivery_request_items?.length || 0} продукта</div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onAddMultiple((r.delivery_request_items || []).map(i => ({
                    product_name: i.product_name, unit: i.unit, product_id: i.product_id,
                  })))
                }}
                className="text-[10px] text-amber-400/60 hover:text-amber-400 mt-1">
                📋 Добави всички към заявка
              </button>
            </div>

            {selectedRequest === r.id && (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                {r.ai_suggestions && (
                  <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-2.5 mb-3 text-xs text-amber-400/80">
                    🤖 {r.ai_suggestions}
                  </div>
                )}
                {r.delivery_request_items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0">
                    <span className="text-white/70">{item.product_name}</span>
                    <span className="text-white/40">{item.quantity} {item.unit}</span>
                  </div>
                ))}
                {userRole === 'admin' && (
                  <button onClick={() => onDelete(r.id)} className="mt-2 text-[10px] text-red-400/50 hover:text-red-400">
                    Изтрий
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
