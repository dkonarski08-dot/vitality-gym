'use client'

import { useState, useEffect } from 'react'
import type { UnifiedCartItem } from '../types'

interface Props {
  items: UnifiedCartItem[]
  clientDiscountPct: number
  saving: boolean
  onQtyChange: (id: string, type: 'product' | 'service', delta: number) => void
  onRemove: (id: string, type: 'product' | 'service') => void
  onCheckout: (method: 'cash' | 'card' | 'unpaid', discountAmount: number) => void
  hasServiceItems: boolean
  clientSelected: boolean
}

export function CartPanel({
  items,
  clientDiscountPct,
  saving,
  onQtyChange,
  onRemove,
  onCheckout,
  hasServiceItems,
  clientSelected,
}: Props) {
  const [discountPct, setDiscountPct] = useState(clientDiscountPct)
  const [discountMode, setDiscountMode] = useState<'pct' | 'eur'>('pct')

  useEffect(() => {
    setDiscountPct(clientDiscountPct)
  }, [clientDiscountPct])

  const subtotal = items.reduce((s, i) => s + i.total_price, 0)
  const discountAmount =
    discountMode === 'pct' ? (subtotal * discountPct) / 100 : discountPct
  const total = Math.max(0, subtotal - discountAmount)

  const isEmpty = items.length === 0
  const unpaidDisabled = !clientSelected && hasServiceItems

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="text-xs text-white/50 uppercase tracking-wider">🛒 Количка</div>

      {isEmpty ? (
        <div className="text-center py-6 text-white/20 text-sm">Количката е празна</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.map(item => (
            <div key={`${item.type}-${item.id}`} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/80 truncate">{item.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                      item.type === 'service'
                        ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                        : 'bg-sky-400/10 text-sky-400 border-sky-400/20'
                    }`}
                  >
                    {item.type === 'service' ? 'услуга' : 'продукт'}
                  </span>
                </div>
                <div className="text-xs text-white/40">€{item.unit_price.toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onQtyChange(item.id, item.type, -1)}
                  className="w-6 h-6 rounded bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-white text-xs w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => onQtyChange(item.id, item.type, 1)}
                  className="w-6 h-6 rounded bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <div className="text-amber-400 text-xs font-medium w-12 text-right shrink-0">
                €{item.total_price.toFixed(2)}
              </div>
              <button
                onClick={() => onRemove(item.id, item.type)}
                className="text-white/30 hover:text-red-400 text-xs transition-colors ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Discount row */}
      {subtotal > 0 && (
        <div className="border-t border-white/10 pt-3 flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setDiscountMode('pct')}
              className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                discountMode === 'pct'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-white/40 border-white/[0.08] hover:text-white/70'
              }`}
            >
              %
            </button>
            <button
              onClick={() => setDiscountMode('eur')}
              className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                discountMode === 'eur'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-white/40 border-white/[0.08] hover:text-white/70'
              }`}
            >
              €
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="number"
              min="0"
              max={discountMode === 'pct' ? 100 : subtotal}
              value={discountPct}
              onChange={e => setDiscountPct(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-white/[0.05] border border-white/10 rounded text-white text-xs focus:outline-none focus:border-amber-400/50"
            />
            {clientDiscountPct > 0 && discountMode === 'pct' && (
              <span className="text-xs text-amber-400/70">(авт.)</span>
            )}
          </div>
          <div className="text-xs text-red-400">
            {discountAmount > 0 ? `-€${discountAmount.toFixed(2)}` : ''}
          </div>
        </div>
      )}

      {/* Summary */}
      {subtotal > 0 && (
        <div className="border-t border-white/10 pt-2 space-y-1">
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-white/50">
              <span>Сума</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-red-400">
              <span>Отстъпка</span>
              <span>-€{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold">
            <span className="text-white">ОБЩО</span>
            <span className="text-amber-400 text-base">€{total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Payment buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onCheckout('cash', discountAmount)}
          disabled={isEmpty || saving}
          className="flex-1 py-2 bg-white/[0.05] border border-white/10 text-white/70 text-xs rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          💵 Брой
        </button>
        <button
          onClick={() => onCheckout('card', discountAmount)}
          disabled={isEmpty || saving}
          className="flex-1 py-2 bg-white/[0.05] border border-white/10 text-white/70 text-xs rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          💳 Карта
        </button>
        <button
          onClick={() => onCheckout('unpaid', discountAmount)}
          disabled={isEmpty || saving || unpaidDisabled}
          title={unpaidDisabled ? 'Изисква избран клиент' : undefined}
          className="flex-1 py-2 bg-white/[0.05] border border-white/10 text-white/70 text-xs rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          📋 Отложи
        </button>
      </div>

      <button
        onClick={() => onCheckout('cash', discountAmount)}
        disabled={isEmpty || saving}
        className="w-full py-3 bg-amber-400/90 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? 'Записване...' : `Продай ${!isEmpty ? `€${total.toFixed(2)}` : ''}`}
      </button>
    </div>
  )
}
