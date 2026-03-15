'use client'
import { useEffect } from 'react'
import type { UnifiedCartItem } from '../types'
import type { BusinessUnit } from '@/src/types/database'

interface ReceiptProps {
  saleId: string
  items: UnifiedCartItem[]
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod: 'cash' | 'card'
  clientName: string | null
  staffName: string
  businessUnit: BusinessUnit
  onClose: () => void
}

export function ReceiptView({
  saleId,
  items,
  subtotal,
  discountAmount,
  total,
  paymentMethod,
  clientName,
  staffName,
  businessUnit,
  onClose,
}: ReceiptProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const now = new Date()
  const dateStr = now.toLocaleDateString('bg-BG')
  const timeStr = now.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm no-print">
      <div className="bg-white text-gray-900 w-80 rounded-xl shadow-2xl overflow-hidden">
        {/* Receipt content */}
        <div className="p-5 font-mono text-sm" id="receipt-content">
          <div className="text-center mb-4">
            <div className="font-bold text-base">
              Vitality {businessUnit === 'gym' ? 'GYM' : 'HALL'}
            </div>
            <div className="text-xs text-gray-500">гр. Пловдив</div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 mb-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Дата:</span>
              <span>
                {dateStr}&nbsp;&nbsp;{timeStr}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Служител:</span>
              <span>{staffName}</span>
            </div>
            <div className="flex justify-between">
              <span>Клиент:</span>
              <span>{clientName ?? '—'}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
            <div className="text-xs font-bold mb-2 flex justify-between">
              <span>Артикул</span>
              <span>Сума</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs mb-1">
                <span className="flex-1 truncate">
                  {item.quantity}x {item.name}
                </span>
                <span className="ml-2">€{item.total_price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 text-xs space-y-1">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Сума:</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Отстъпка:</span>
                  <span>-€{discountAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-sm pt-1">
              <span>ОБЩО:</span>
              <span>€{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Плащане:</span>
              <span>{paymentMethod === 'cash' ? 'В брой' : 'Карта'}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-2 mt-3 text-center text-xs text-gray-400">
            №{saleId.slice(0, 8).toUpperCase()}
          </div>
        </div>
        {/* Buttons */}
        <div className="flex gap-2 p-3 bg-gray-50 border-t border-gray-200 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            🖨️ Принтирай
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-400 transition-colors"
          >
            Затвори
          </button>
        </div>
      </div>
    </div>
  )
}
