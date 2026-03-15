// app/(dashboard)/sales/components/SaleHistory.tsx
'use client'

import { useState } from 'react'
import type { Sale } from '../types'

interface Props {
  sales: Sale[]
  loading: boolean
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onVoid: (saleId: string) => Promise<boolean>
  userRole: string
}

const METHOD_LABEL: Record<string, string> = {
  cash: '💵 Брой',
  card: '💳 Карта',
}

export function SaleHistory({ sales, loading, from, to, onFromChange, onToChange, onVoid, userRole }: Props) {
  const [voidingId, setVoidingId] = useState<string | null>(null)

  const handleVoid = async (saleId: string) => {
    if (!confirm('Анулиране на продажбата?')) return
    setVoidingId(saleId)
    await onVoid(saleId)
    setVoidingId(null)
  }

  const exportCsv = () => {
    const rows = [
      ['Дата', 'Час', 'Продукти', 'Сума', 'Метод', 'Персонал', 'Анулирана'],
      ...sales.map(s => [
        s.sale_date,
        s.sale_time,
        (s.sale_items || []).map(i => `${i.product_name} x${i.quantity}`).join('; '),
        s.total_amount.toFixed(2),
        s.payment_method,
        s.staff_name,
        s.voided ? 'Да' : 'Не',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50">От</label>
          <input
            type="date"
            value={from}
            onChange={e => onFromChange(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50">До</label>
          <input
            type="date"
            value={to}
            onChange={e => onToChange(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={sales.length === 0}
          className="ml-auto px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-xs transition-all disabled:opacity-30"
        >
          ↓ CSV
        </button>
      </div>

      {/* Summary */}
      {sales.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Продажби', value: sales.filter(s => !s.voided).length.toString(), icon: '🛒' },
            {
              label: 'Брой',
              value: `€${sales.filter(s => !s.voided && s.payment_method === 'cash').reduce((s, r) => s + r.total_amount, 0).toFixed(2)}`,
              icon: '💵',
            },
            {
              label: 'Карта',
              value: `€${sales.filter(s => !s.voided && s.payment_method === 'card').reduce((s, r) => s + r.total_amount, 0).toFixed(2)}`,
              icon: '💳',
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="text-xs text-white/40 mb-1">{icon} {label}</div>
              <div className="text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">Няма продажби за периода</div>
      ) : (
        <div className="space-y-2">
          {sales.map(sale => (
            <div
              key={sale.id}
              className={`bg-white/[0.03] border rounded-xl p-4 ${sale.voided ? 'border-white/5 opacity-50' : 'border-white/10'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-white/50">{sale.sale_date} {sale.sale_time?.slice(0, 5)}</span>
                    <span className="text-xs text-white/40">·</span>
                    <span className="text-xs text-white/50">{sale.staff_name}</span>
                    {sale.voided && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Анулирана</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(sale.sale_items || []).map(item => (
                      <span key={item.id} className="text-xs bg-white/[0.05] text-white/60 px-2 py-0.5 rounded">
                        {item.product_name} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-amber-400">€{sale.total_amount.toFixed(2)}</div>
                    <div className="text-xs text-white/40">{METHOD_LABEL[sale.payment_method]}</div>
                  </div>
                  {userRole === 'admin' && !sale.voided && (
                    <button
                      onClick={() => handleVoid(sale.id)}
                      disabled={voidingId === sale.id}
                      className="px-2 py-1 text-xs text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded-lg transition-all disabled:opacity-30"
                    >
                      {voidingId === sale.id ? '...' : 'Анулирай'}
                    </button>
                  )}
                </div>
              </div>
              {sale.notes && (
                <div className="mt-2 text-xs text-white/30 italic">{sale.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
