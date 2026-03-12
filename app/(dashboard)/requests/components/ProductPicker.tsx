// app/(dashboard)/requests/components/ProductPicker.tsx
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { DeliveryProduct, DraftItem, Supplier, SupplierProduct } from '../types'
import { ProductCard } from './ProductCard'

interface Props {
  topProducts: DeliveryProduct[]
  draftItems: DraftItem[]
  onAddProduct: (name: string, unit: string, productId: string | null) => void
}

type TabType = 'category' | 'supplier'

export function ProductPicker({ topProducts, draftItems, onAddProduct }: Props) {
  const [tab, setTab] = useState<TabType>('category')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<DeliveryProduct[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [loadingSupplier, setLoadingSupplier] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Derive categories from topProducts client-side
  const categories = ['all', ...new Set(topProducts.map(p => p.category).filter(Boolean))]

  const filteredProducts = selectedCategory === 'all'
    ? topProducts
    : topProducts.filter(p => p.category === selectedCategory)

  const isDraftItem = useCallback((name: string) =>
    draftItems.some(i => i.product_name === name), [draftItems])

  // Load suppliers once
  useEffect(() => {
    fetch('/api/requests?type=suppliers')
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  // Load supplier products on selection
  useEffect(() => {
    if (!selectedSupplier) { setSupplierProducts([]); return }
    setLoadingSupplier(true)
    fetch(`/api/requests?type=supplier&name=${encodeURIComponent(selectedSupplier)}`)
      .then(r => r.json())
      .then(d => setSupplierProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoadingSupplier(false))
  }, [selectedSupplier])

  // Autocomplete search with debounce
  useEffect(() => {
    if (search.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/requests?type=search&q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSuggestions(data.products || [])
        setShowSuggestions(true)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const handleAddFromSuggestion = (p: DeliveryProduct) => {
    onAddProduct(p.clean_name ?? p.name, p.unit, p.id)
    setSearch('')
    setSuggestions([])
    setShowSuggestions(false)
    searchRef.current?.focus()
  }

  const handleAddManual = () => {
    if (!manualInput.trim()) return
    onAddProduct(manualInput.trim(), 'бр', null)
    setManualInput('')
    setShowManual(false)
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setShowSuggestions(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && suggestions.length > 0) handleAddFromSuggestion(suggestions[0])
            else if (e.key === 'Escape') { setShowSuggestions(false); setSearch('') }
          }}
          placeholder="Търси продукт... (мин. 2 букви)"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30"
        />
        {searching && (
          <div className="absolute right-3 top-3.5">
            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f14] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
            {suggestions.map(p => (
              <button
                key={p.id}
                onClick={() => handleAddFromSuggestion(p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <div className="text-sm text-white">{p.clean_name ?? p.name}</div>
                  <div className="text-[10px] text-white/30">{p.category} · {p.unit}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  {p.last_price && <div className="text-xs text-white/50">{p.last_price.toFixed(2)}€</div>}
                  <div className="text-[10px] text-white/25">{p.order_count}×</div>
                </div>
              </button>
            ))}
            {search.trim() && !suggestions.some(s => (s.clean_name ?? s.name).toLowerCase() === search.toLowerCase()) && (
              <button
                onClick={() => { onAddProduct(search.trim(), 'бр', null); setSearch(''); setShowSuggestions(false) }}
                className="w-full flex items-center px-4 py-3 hover:bg-white/5 text-left border-t border-white/[0.06]"
              >
                <span className="text-xs text-amber-400">+ Добави &quot;{search}&quot; като нов продукт</span>
              </button>
            )}
          </div>
        )}

        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
        <button
          onClick={() => setTab('category')}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'category' ? 'bg-[#0f0f14] text-white border border-white/10' : 'text-white/40 hover:text-white/60'
          }`}
        >
          📦 По категория
        </button>
        <button
          onClick={() => setTab('supplier')}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'supplier' ? 'bg-[#0f0f14] text-white border border-white/10' : 'text-white/40 hover:text-white/60'
          }`}
        >
          🏪 По доставчик
        </button>
      </div>

      {/* Category tab */}
      {tab === 'category' && (
        <div>
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-400/15 text-amber-400'
                    : 'bg-white/5 text-white/40 hover:text-white/60'
                }`}
              >
                {cat === 'all' ? '⭐ Всички' : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {filteredProducts.slice(0, 32).map(p => {
              const displayName = p.clean_name ?? p.name
              return (
                <ProductCard
                  key={p.id}
                  name={displayName}
                  orderCount={p.order_count}
                  inDraft={isDraftItem(displayName)}
                  onClick={() => onAddProduct(displayName, p.unit, p.id)}
                />
              )
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/30 text-xs">Няма продукти</div>
            )}
          </div>
        </div>
      )}

      {/* Supplier tab */}
      {tab === 'supplier' && (
        <div>
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400/50 focus:outline-none mb-4 appearance-none"
          >
            <option value="">Избери доставчик...</option>
            {suppliers.map(s => (
              <option key={s.supplier_name} value={s.supplier_name}>
                {s.supplier_name} ({s.product_count} продукта)
              </option>
            ))}
          </select>

          {loadingSupplier && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}

          {!loadingSupplier && selectedSupplier && supplierProducts.length === 0 && (
            <div className="text-center py-8 text-white/30 text-xs">Няма данни за този доставчик</div>
          )}

          {!loadingSupplier && supplierProducts.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {supplierProducts.map((p, i) => {
                const displayName = p.clean_name ?? p.product_name
                return (
                  <ProductCard
                    key={i}
                    name={displayName}
                    inDraft={isDraftItem(displayName)}
                    onClick={() => onAddProduct(displayName, p.unit, null)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual add */}
      <div className="border-t border-white/[0.05] pt-3">
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-amber-400/50 hover:text-amber-400 transition-colors"
          >
            + Добави продукт ръчно
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              autoFocus
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); if (e.key === 'Escape') setShowManual(false) }}
              placeholder="Име на продукт..."
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400/50 focus:outline-none placeholder:text-white/30"
            />
            <button
              onClick={handleAddManual}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
            >
              Добави
            </button>
            <button
              onClick={() => { setShowManual(false); setManualInput('') }}
              className="px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
