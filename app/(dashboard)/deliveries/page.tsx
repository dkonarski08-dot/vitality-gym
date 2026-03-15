'use client'
// app/(dashboard)/deliveries/page.tsx — Layout A: Command Deck
import { useState } from 'react'
import { useDeliveries } from './hooks/useDeliveries'
import DeliveryForm from './components/DeliveryForm'
import DeliveryHistory from './components/DeliveryHistory'
import DeliveryExpiry from './components/DeliveryExpiry'
import DeliveryAnalysis from './components/DeliveryAnalysis'
import SuppliersTab from './components/SuppliersTab'

type TabKey = 'upload' | 'history' | 'expiry' | 'insights' | 'suppliers'

export default function DeliveriesPage() {
  const hook = useDeliveries()
  const { userRole, loading, expiringItems } = hook
  const [activeTab, setActiveTab] = useState<TabKey>('upload')

  const tabs = [
    { key: 'upload' as TabKey, label: '📸 Нова' },
    { key: 'history' as TabKey, label: '📋 История' },
    ...(userRole === 'admin' ? [
      { key: 'expiry' as TabKey, label: `⏰ Изтичащи${expiringItems.length ? ` (${expiringItems.length})` : ''}` },
      { key: 'insights' as TabKey, label: '📊 Анализ' },
      { key: 'suppliers' as TabKey, label: '🏢 Доставчици' },
    ] : []),
  ]

  // Upload tab: full-height split layout, no scroll
  if (activeTab === 'upload') {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06] bg-[#060609]/90 backdrop-blur-xl">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Доставки</h1>
              <p className="text-[10px] text-white/40 mt-0.5">Фактури и инвентар</p>
            </div>
          </div>
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-amber-400/15 text-amber-400' : 'text-white/40 hover:text-white/60'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {/* Form fills remaining height */}
        <DeliveryForm hook={hook} onSaveSuccess={() => setActiveTab('history')} />
      </div>
    )
  }

  // All other tabs: normal scrolling layout
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">Доставки</h1>
          <p className="text-sm text-white/60 mt-0.5">Фактури и инвентар</p>
        </div>
        <div className="flex gap-1 mt-3">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-amber-400/15 text-amber-400' : 'text-white/40 hover:text-white/60'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-6 ${activeTab === 'suppliers' ? 'max-w-[1400px]' : 'max-w-4xl'} mx-auto`}>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'history' && <DeliveryHistory hook={hook} />}
            {activeTab === 'expiry' && <DeliveryExpiry hook={hook} />}
            {activeTab === 'insights' && <DeliveryAnalysis hook={hook} />}
            {activeTab === 'suppliers' && <SuppliersTab />}
          </>
        )}
      </div>
    </div>
  )
}
