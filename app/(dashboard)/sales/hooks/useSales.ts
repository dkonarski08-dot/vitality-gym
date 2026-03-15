// app/(dashboard)/sales/hooks/useSales.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import { getTodayISO } from '@/lib/formatters'
import type { Sale, SaleProduct, CartItem, PaymentMethod, UnifiedCartItem } from '../types'
import type { BusinessUnit, Client } from '@/src/types/database'

export function useSales() {
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyFrom, setHistoryFrom] = useState(getTodayISO())
  const [historyTo, setHistoryTo] = useState(getTodayISO())
  const [saving, setSaving] = useState(false)

  // New unified POS state
  const [businessUnit, setBusinessUnitState] = useState<BusinessUnit>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pos_business_unit') as BusinessUnit) ?? 'gym'
    }
    return 'gym'
  })
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [unifiedCart, setUnifiedCart] = useState<UnifiedCartItem[]>([])

  const setBusinessUnit = useCallback((unit: BusinessUnit) => {
    setBusinessUnitState(unit)
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_business_unit', unit)
    }
  }, [])

  const clearCart = useCallback(() => {
    setUnifiedCart([])
  }, [])

  const addToCart = useCallback((item: UnifiedCartItem) => {
    setUnifiedCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === item.type)
      if (existing) {
        return prev.map(i =>
          i.id === item.id && i.type === item.type
            ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
            : i
        )
      }
      return [...prev, item]
    })
  }, [])

  const removeFromCart = useCallback((id: string, type: 'product' | 'service') => {
    setUnifiedCart(prev => prev.filter(i => !(i.id === id && i.type === type)))
  }, [])

  const updateQty = useCallback((id: string, type: 'product' | 'service', delta: number) => {
    setUnifiedCart(prev => {
      const item = prev.find(i => i.id === id && i.type === type)
      if (!item) return prev
      const newQty = item.quantity + delta
      if (newQty <= 0) {
        return prev.filter(i => !(i.id === id && i.type === type))
      }
      return prev.map(i =>
        i.id === id && i.type === type
          ? { ...i, quantity: newQty, total_price: newQty * i.unit_price }
          : i
      )
    })
  }, [])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await fetch('/api/sales?type=products')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setProducts(data.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане на продукти')
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const loadSales = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales?from=${from}&to=${to}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setSales(data.sales || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [])

  const createSale = useCallback(async (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    notes?: string
  ): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', items, payment_method: paymentMethod, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запис')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const createSaleFromCart = useCallback(async (
    paymentMethod: 'cash' | 'card',
    discountAmount: number
  ): Promise<{ ok: boolean; saleId?: string }> => {
    setSaving(true)
    setError(null)
    try {
      const cartSnapshot = unifiedCart
      const total = cartSnapshot.reduce((s, i) => s + i.total_price, 0) - discountAmount
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          items: cartSnapshot,
          payment_method: paymentMethod,
          client_id: selectedClient?.id ?? null,
          discount_amount: discountAmount,
          business_unit: businessUnit,
          total_amount: total,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      clearCart()
      return { ok: true, saleId: data.sale_id }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запис')
      return { ok: false }
    } finally {
      setSaving(false)
    }
  }, [unifiedCart, selectedClient, businessUnit, clearCart])

  const createOpenTab = useCallback(async (discountAmount: number): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const cartSnapshot = unifiedCart
      const res = await fetch('/api/open-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tab',
          items: cartSnapshot,
          total_amount: cartSnapshot.reduce((s, i) => s + i.total_price, 0) - discountAmount,
          discount_amount: discountAmount,
          client_id: selectedClient?.id ?? null,
          business_unit: businessUnit,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      clearCart()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запис')
      return false
    } finally {
      setSaving(false)
    }
  }, [unifiedCart, selectedClient, businessUnit, clearCart])

  const voidSale = useCallback(async (saleId: string): Promise<boolean> => {
    setError(null)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', sale_id: saleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, voided: true } : s))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при анулиране')
      return false
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadSales(historyFrom, historyTo)
  }, [loadSales, historyFrom, historyTo])

  const hasServices = unifiedCart.some(i => i.type === 'service')
  const canCheckout = unifiedCart.length > 0 && (!hasServices || selectedClient !== null)

  return {
    // Existing
    products,
    sales,
    loading,
    productsLoading,
    saving,
    error,
    setError,
    historyFrom,
    setHistoryFrom,
    historyTo,
    setHistoryTo,
    createSale,
    voidSale,
    refreshSales: () => loadSales(historyFrom, historyTo),
    // New unified POS
    businessUnit,
    setBusinessUnit,
    selectedClient,
    setSelectedClient,
    unifiedCart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    canCheckout,
    createSaleFromCart,
    createOpenTab,
  }
}
