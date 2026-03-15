// app/(dashboard)/sales/components/SalesReport.tsx
'use client'

import type { Sale } from '../types'

interface Props {
  sales: Sale[]
  from: string
  to: string
}

export function SalesReport({ sales, from, to }: Props) {
  const active = sales.filter(s => !s.voided)
  const cashTotal = active.filter(s => s.payment_method === 'cash').reduce((s, r) => s + r.total_amount, 0)
  const cardTotal = active.filter(s => s.payment_method === 'card').reduce((s, r) => s + r.total_amount, 0)
  const total = cashTotal + cardTotal

  // Top products
  const productTotals: Record<string, { name: string; qty: number; revenue: number; category: string | null }> = {}
  for (const sale of active) {
    for (const item of sale.sale_items || []) {
      const key = item.product_name
      if (!productTotals[key]) productTotals[key] = { name: item.product_name, qty: 0, revenue: 0, category: item.category }
      productTotals[key].qty += item.quantity
      productTotals[key].revenue += item.total_price
    }
  }
  const topProducts = Object.values(productTotals)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Category breakdown
  const categoryTotals: Record<string, number> = {}
  for (const p of Object.values(productTotals)) {
    const cat = p.category || 'Без категория'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + p.revenue
  }
  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* Period + summary */}
      <div className="text-xs text-white/40 text-center">Период: {from} — {to}</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Общо приходи', value: `€${total.toFixed(2)}`, color: 'text-amber-400' },
          { label: 'В брой', value: `€${cashTotal.toFixed(2)}`, color: 'text-emerald-400' },
          { label: 'С карта', value: `€${cardTotal.toFixed(2)}`, color: 'text-sky-400' },
          { label: 'Транзакции', value: active.length.toString(), color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
            <div className="text-xs text-white/40 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 products */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Топ продукти</div>
          {topProducts.length === 0 ? (
            <div className="text-center py-6 text-white/20 text-sm">Няма данни</div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs text-white/30 w-4 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">{p.name}</div>
                    <div className="text-xs text-white/30">{p.qty} бр.</div>
                  </div>
                  <span className="text-sm font-medium text-amber-400">€{p.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-3">По категория</div>
          {categories.length === 0 ? (
            <div className="text-center py-6 text-white/20 text-sm">Няма данни</div>
          ) : (
            <div className="space-y-2">
              {categories.map(([cat, rev]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-white/70">{cat}</div>
                    <div className="mt-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400/60 rounded-full"
                        style={{ width: `${total > 0 ? (rev / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-amber-400 w-20 text-right">€{rev.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
