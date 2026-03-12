'use client'
// Tab 4 — Анализ
import { PRODUCT_CATEGORIES } from '@/src/constants/categories'
import { MONTHS_BG } from '@/lib/formatters'
import type { DeliveriesHookReturn } from '../hooks/useDeliveries'

interface DeliveryAnalysisProps {
  hook: DeliveriesHookReturn
}

export default function DeliveryAnalysis({ hook }: DeliveryAnalysisProps) {
  const {
    sortedMonths,
    insightDeliveries, supplierBreakdown, categoryBreakdown, maxCat, productFrequency,
    insightCategory, insightFrom, insightTo,
    setInsightCategory, setInsightFrom, setInsightTo,
  } = hook

  return (
    <div>
      {/* Period filter */}
      <div className="flex items-center gap-3 mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-3">
        <span className="text-xs text-white/50">Период:</span>
        <select value={insightFrom} onChange={e => setInsightFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
          <option value="">Начало</option>
          {sortedMonths.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{MONTHS_BG[parseInt(mo) - 1]} {y}</option>
          })}
        </select>
        <span className="text-xs text-white/30">→</span>
        <select value={insightTo} onChange={e => setInsightTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
          <option value="">Сега</option>
          {sortedMonths.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{MONTHS_BG[parseInt(mo) - 1]} {y}</option>
          })}
        </select>
        <span className="text-xs text-white/40 ml-auto">{insightDeliveries.length} одобрени доставки</span>
      </div>

      {/* Category spend chart */}
      <div className="mb-8">
        <div className="text-xs text-white/60 uppercase tracking-widest mb-3 font-medium">Разходи по категория</div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
          {categoryBreakdown.length === 0 ? (
            <div className="text-center text-white/40 py-6 text-sm">Няма данни</div>
          ) : categoryBreakdown.map(([c, d]) => (
            <div key={c} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/80">{c}</span>
                <span className="text-sm font-bold text-white">{d.total.toFixed(2)}€</span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${(d.total / maxCat) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier + product breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-white/60 uppercase tracking-widest mb-3 font-medium">По доставчик</div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {supplierBreakdown.map(([n, d]) => (
              <div key={n} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0">
                <div>
                  <div className="text-sm text-white font-medium">{n}</div>
                  <div className="text-xs text-white/40">{d.count} доставки</div>
                </div>
                <div className="text-sm font-bold text-white">{d.total.toFixed(2)}€</div>
              </div>
            ))}
            {supplierBreakdown.length === 0 && <div className="text-center text-white/40 py-8 text-sm">Няма</div>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-white/60 uppercase tracking-widest font-medium">Топ продукти</div>
            <select value={insightCategory} onChange={e => setInsightCategory(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/60 focus:outline-none">
              <option value="all">Всички</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {productFrequency.slice(0, 15).map(([n, d]) => (
              <div key={n} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0">
                <div className="text-sm text-white/80 flex-1 mr-3">{n}</div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-white">{d.totalSpend.toFixed(2)}€</div>
                  <div className="text-[10px] text-white/40">{d.count}× · {d.totalQty}</div>
                </div>
              </div>
            ))}
            {productFrequency.length === 0 && <div className="text-center text-white/40 py-8 text-sm">Няма</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
