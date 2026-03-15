// app/(dashboard)/sales/components/NewSaleTab.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { SaleProduct, CartItem, PaymentMethod } from '../types'

interface Props {
  products: SaleProduct[]
  loading: boolean
  saving: boolean
  onConfirm: (items: CartItem[], paymentMethod: PaymentMethod, notes?: string) => Promise<boolean>
}

export function NewSaleTab({ products, loading, saving, onConfirm }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Refocus barcode input for USB scanner when no other interactive element is active
  useEffect(() => {
    const INTERACTIVE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']
    const timer = setInterval(() => {
      const active = document.activeElement
      if (!active || !INTERACTIVE_TAGS.includes(active.tagName) || active === barcodeRef.current) {
        barcodeRef.current?.focus()
      }
    }, 500)
    return () => clearInterval(timer)
  }, [])

  const addToCart = useCallback((product: SaleProduct) => {
    if (!product.selling_price) return
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
          : i
        )
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        unit: product.unit,
        unit_price: product.selling_price!,
        quantity: 1,
        total_price: product.selling_price!,
      }]
    })
  }, [])

  const handleBarcodeSubmit = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const code = barcodeInput.trim()
    if (!code) return
    const match = products.find(p => p.barcode === code)
    if (match) {
      addToCart(match)
      setBarcodeInput('')
    } else {
      setBarcodeInput('')
    }
  }, [barcodeInput, products, addToCart])

  const updateQuantity = (productId: string | null, productName: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => !(i.product_id === productId && i.product_name === productName)))
    } else {
      setCart(prev => prev.map(i =>
        i.product_id === productId && i.product_name === productName
          ? { ...i, quantity: qty, total_price: qty * i.unit_price }
          : i
      ))
    }
  }

  const total = cart.reduce((sum, i) => sum + i.total_price, 0)

  const handleConfirm = async () => {
    if (cart.length === 0) return
    const ok = await onConfirm(cart, paymentMethod, notes || undefined)
    if (ok) {
      setCart([])
      setNotes('')
      setSuccessMsg('Продажбата е записана!')
      setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode === search
  )

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Grid */}
      <div className="lg:col-span-2 space-y-4">
        {/* Barcode + Search */}
        <div className="flex gap-3">
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeSubmit}
            placeholder="Баркод (Enter)"
            className="w-36 px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Търси продукт..."
            className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-white/30 text-sm">Няма продукти за продажба</div>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={!p.selling_price}
              className="group p-3 bg-white/[0.03] border border-white/10 rounded-xl text-left hover:bg-white/[0.07] hover:border-amber-400/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <div className="text-xs text-white/40 mb-1 truncate">{p.category || 'Без категория'}</div>
              <div className="text-sm font-medium text-white/90 leading-tight mb-2 line-clamp-2">{p.name}</div>
              <div className="text-amber-400 font-semibold text-sm">
                {p.selling_price ? `€${p.selling_price.toFixed(2)}` : '—'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col gap-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex-1">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Количка</div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">Празна количка</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {cart.map(item => (
                <div key={`${item.product_id}-${item.product_name}`} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/80 truncate">{item.product_name}</div>
                    <div className="text-xs text-white/40">€{item.unit_price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.product_name, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs flex items-center justify-center"
                    >−</button>
                    <span className="text-white text-xs w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.product_name, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs flex items-center justify-center"
                    >+</button>
                  </div>
                  <div className="text-amber-400 text-xs font-medium w-12 text-right">
                    €{item.total_price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="border-t border-white/10 mt-3 pt-3">
              <div className="flex justify-between text-sm font-semibold text-white">
                <span>Общо</span>
                <span className="text-amber-400">€{total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="flex gap-2">
          {(['cash', 'card'] as PaymentMethod[]).map(m => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                paymentMethod === m
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
                  : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              {m === 'cash' ? '💵 Брой' : '💳 Карта'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Бележка (по желание)"
          className="px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
        />

        {successMsg && (
          <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm text-center">
            {successMsg}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={cart.length === 0 || saving}
          className="w-full py-3 bg-amber-400/90 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Записване...' : `Потвърди ${cart.length > 0 ? `€${total.toFixed(2)}` : ''}`}
        </button>
      </div>
    </div>
  )
}
