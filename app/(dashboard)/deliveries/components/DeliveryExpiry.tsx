'use client'
// Tab 3 — Изтичащи
import type { DeliveriesHookReturn } from '../hooks/useDeliveries'

interface DeliveryExpiryProps {
  hook: DeliveriesHookReturn
}

function dateShort(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function DeliveryExpiry({ hook }: DeliveryExpiryProps) {
  const { expiringItems } = hook

  if (expiringItems.length === 0) {
    return <div className="text-center py-20 text-white/40">Няма изтичащи</div>
  }

  return (
    <div className="space-y-2">
      {expiringItems.map((item, i) => {
        const d = daysUntil(item.expiry_date!)
        return (
          <div key={i} className={`border rounded-xl p-4 ${d <= 14 ? 'bg-red-500/[0.06] border-red-500/25' : d <= 30 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-white/[0.03] border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{item.product_name}</div>
                <div className="text-xs text-white/50">{item.supplier} · {item.quantity} {item.unit}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${d <= 14 ? 'text-red-400' : d <= 30 ? 'text-amber-400' : 'text-white/60'}`}>
                  {d <= 0 ? 'ИЗТЕКЪЛ' : `${d} дни`}
                </div>
                <div className="text-xs text-white/40">{dateShort(item.expiry_date!)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
