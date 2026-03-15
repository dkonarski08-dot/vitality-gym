// app/(dashboard)/sales/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSales } from './hooks/useSales'
import { useOpenTabs } from './hooks/useOpenTabs'
import { NewSaleTab } from './components/NewSaleTab'
import { SaleHistory } from './components/SaleHistory'
import { SalesReport } from './components/SalesReport'
import { BusinessUnitSwitch } from './components/BusinessUnitSwitch'
import { ClientSearchPanel } from './components/ClientSearchPanel'
import { ServiceGrid } from './components/ServiceGrid'
import { CartPanel } from './components/CartPanel'
import { OpenTabsList } from './components/OpenTabsList'
import { ServiceCatalogAdmin } from './components/ServiceCatalogAdmin'
import { ReceiptView } from './components/ReceiptView'
import { useSession } from '@/hooks/useSession'
import type { SalesTab, UnifiedCartItem } from './types'
import type { ServiceType } from '@/src/types/database'
import { DISCOUNT_BY_TIER } from './constants'
import { getTodayISO } from '@/lib/formatters'

interface ReceiptData {
  saleId: string
  items: UnifiedCartItem[]
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod: 'cash' | 'card'
  clientName: string | null
}

const BASE_TABS: { key: SalesTab; label: string }[] = [
  { key: 'pos', label: 'Продажба' },
  { key: 'services', label: 'Услуги' },
  { key: 'open_tabs', label: 'Отложени' },
  { key: 'history', label: 'История' },
  { key: 'report', label: 'Отчет' },
]

const ADMIN_TABS: { key: SalesTab; label: string }[] = [
  ...BASE_TABS,
  { key: 'catalog', label: 'Каталог' },
]

export default function SalesPage() {
  const { userRole, userName } = useSession()
  const s = useSales()
  const openTabsHook = useOpenTabs()
  const [activeTab, setActiveTab] = useState<SalesTab>('pos')
  const [lastSaleReceipt, setLastSaleReceipt] = useState<ReceiptData | null>(null)

  const tabs = userRole === 'admin' ? ADMIN_TABS : BASE_TABS

  useEffect(() => {
    if (activeTab === 'open_tabs') openTabsHook.load()
  }, [activeTab, openTabsHook])

  const handleAddService = (service: ServiceType, startDate?: string) => {
    const item: UnifiedCartItem = {
      type: 'service',
      id: service.id,
      name: service.name,
      category: service.category,
      unit_price: service.price,
      quantity: 1,
      total_price: service.price,
      integration_type: service.integration_type,
      starts_at: startDate ?? getTodayISO(),
    }
    s.addToCart(item)
  }

  const handleCheckout = async (method: 'cash' | 'card' | 'unpaid', discountAmount: number) => {
    if (method === 'unpaid') {
      const ok = await s.createOpenTab(discountAmount)
      if (ok) {
        setActiveTab('open_tabs')
        openTabsHook.load()
      }
    } else {
      // Capture cart before it gets cleared
      const cartSnapshot = [...s.unifiedCart]
      const subtotal = cartSnapshot.reduce((sum, i) => sum + i.total_price, 0)
      const total = Math.max(0, subtotal - discountAmount)

      const result = await s.createSaleFromCart(method, discountAmount)
      if (result.ok) {
        setLastSaleReceipt({
          saleId: result.saleId ?? '',
          items: cartSnapshot,
          subtotal,
          discountAmount,
          total,
          paymentMethod: method,
          clientName: s.selectedClient?.name ?? null,
        })
        s.refreshSales()
      }
    }
  }

  const isPOSTab = activeTab === 'pos' || activeTab === 'services'
  const clientDiscountPct = DISCOUNT_BY_TIER[s.selectedClient?.discount_tier ?? 'none']

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-white">🛒 Продажби</h1>
        <BusinessUnitSwitch value={s.businessUnit} onChange={s.setBusinessUnit} />
        <div className="ml-auto" />
      </div>

      {/* Error banner */}
      {s.error && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <span>⚠️ {s.error}</span>
          <button onClick={() => s.setError(null)} className="ml-auto opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: tabs + content + cart */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 min-w-0">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-xl w-fit flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'pos' && (
              <NewSaleTab
                products={s.products}
                loading={s.productsLoading}
                saving={s.saving}
                onConfirm={async (items, pm, notes) => {
                  const ok = await s.createSale(items, pm, notes)
                  if (ok) s.refreshSales()
                  return ok
                }}
              />
            )}

            {activeTab === 'services' && (
              <ServiceGrid
                businessUnit={s.businessUnit}
                clientSelected={!!s.selectedClient}
                onAddService={handleAddService}
              />
            )}

            {activeTab === 'open_tabs' && (
              <OpenTabsList
                tabs={openTabsHook.tabs}
                loading={openTabsHook.loading}
                userRole={userRole ?? ''}
                onPay={async (id, method) => {
                  await openTabsHook.payTab(id, method)
                  openTabsHook.load()
                }}
                onDelete={async id => {
                  await openTabsHook.deleteTab(id)
                }}
                onRefresh={openTabsHook.load}
              />
            )}

            {activeTab === 'history' && (
              <SaleHistory
                sales={s.sales}
                loading={s.loading}
                from={s.historyFrom}
                to={s.historyTo}
                onFromChange={s.setHistoryFrom}
                onToChange={s.setHistoryTo}
                onVoid={s.voidSale}
                userRole={userRole ?? ''}
              />
            )}

            {activeTab === 'report' && (
              <SalesReport
                sales={s.sales}
                from={s.historyFrom}
                to={s.historyTo}
              />
            )}

            {activeTab === 'catalog' && (
              <ServiceCatalogAdmin userRole={userRole ?? ''} />
            )}
          </div>

          {/* CartPanel — only for services tab (pos tab has its own NewSaleTab cart) */}
          {activeTab === 'services' && (
            <CartPanel
              items={s.unifiedCart}
              clientDiscountPct={clientDiscountPct}
              saving={s.saving}
              onQtyChange={s.updateQty}
              onRemove={s.removeFromCart}
              onCheckout={handleCheckout}
              hasServiceItems={s.unifiedCart.some(i => i.type === 'service')}
              clientSelected={!!s.selectedClient}
            />
          )}
        </div>

        {/* Right: Client panel — shown on pos/services tabs */}
        {isPOSTab && (
          <div className="w-72 border-l border-white/[0.06] p-4 overflow-y-auto shrink-0">
            <ClientSearchPanel
              selectedClient={s.selectedClient}
              onClientSelect={s.setSelectedClient}
            />
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {lastSaleReceipt && (
        <ReceiptView
          saleId={lastSaleReceipt.saleId}
          items={lastSaleReceipt.items}
          subtotal={lastSaleReceipt.subtotal}
          discountAmount={lastSaleReceipt.discountAmount}
          total={lastSaleReceipt.total}
          paymentMethod={lastSaleReceipt.paymentMethod}
          clientName={lastSaleReceipt.clientName}
          staffName={userName ?? ''}
          businessUnit={s.businessUnit}
          onClose={() => setLastSaleReceipt(null)}
        />
      )}
    </div>
  )
}
