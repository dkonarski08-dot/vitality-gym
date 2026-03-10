// app/(dashboard)/cash/components/AlertsSection.tsx
import { CashRecord } from '../types'
import { formatDateShort } from '@/lib/formatters'

interface Props {
  alertRecords: CashRecord[]
}

export function AlertsSection({ alertRecords }: Props) {
  if (alertRecords.length === 0) return null

  return (
    <div className="mb-6">
      <div className="text-xs text-red-400 uppercase tracking-widest mb-3">⚠️ Аномалии</div>
      <div className="space-y-2">
        {alertRecords.slice(0, 10).map(r => (
          <div key={r.id} className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-white font-medium">{formatDateShort(r.date)} — {r.staff_name}</div>
              {r.gym_cash_counted != null && r.admin_cash_counted != null && (
                <div className="text-xs text-red-400 mt-0.5">
                  Рецепция: {r.gym_cash_counted.toFixed(2)}€ / Admin: {r.admin_cash_counted.toFixed(2)}€
                  {' '}(разлика: {(r.admin_cash_counted - r.gym_cash_counted).toFixed(2)}€)
                </div>
              )}
              {r.notes && <div className="text-xs text-white/40 mt-0.5 italic">{r.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
