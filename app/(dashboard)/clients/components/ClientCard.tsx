'use client'
import type { Client } from '@/src/types/database'

const DISCOUNT_LABELS = {
  none: null,
  standard: 'Стандартна 5%',
  vip: 'VIP 10%',
}

const DISCOUNT_COLORS = {
  none: '',
  standard: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  vip: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
}

interface Props {
  client: Client
  onEdit?: () => void
  compact?: boolean
}

export function ClientCard({ client, onEdit, compact = false }: Props) {
  const initials = client.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  const discountLabel = DISCOUNT_LABELS[client.discount_tier]
  const discountColor = DISCOUNT_COLORS[client.discount_tier]

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">{client.name}</div>
          <div className="text-white/40 text-xs">{client.phone}</div>
        </div>
        {discountLabel && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded border ${discountColor} shrink-0`}>
            {discountLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-start gap-4">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-base font-bold text-black shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-semibold">{client.name}</span>
          {discountLabel && (
            <span className={`text-xs px-2 py-0.5 rounded border ${discountColor}`}>
              {discountLabel}
            </span>
          )}
        </div>
        <div className="text-white/50 text-sm mt-0.5">{client.phone}</div>
        {client.notes && (
          <div className="text-white/40 text-xs mt-1 truncate">{client.notes}</div>
        )}
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-white/40 hover:text-amber-400 text-xs px-2 py-1 rounded border border-white/[0.08] hover:border-amber-400/30 transition-colors shrink-0"
        >
          Редактирай
        </button>
      )}
    </div>
  )
}
