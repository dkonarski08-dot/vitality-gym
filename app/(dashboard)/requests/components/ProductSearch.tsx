// app/(dashboard)/requests/components/ProductSearch.tsx
import React from 'react'
import { Product, RequestItem } from '../types'

interface Props {
  search: string
  setSearch: (v: string) => void
  suggestions: Product[]
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  searching: boolean
  searchRef: React.RefObject<HTMLInputElement>
  draftItems: RequestItem[]
  filteredTop: Product[]
  availableCategories: string[]
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  onAddProduct: (p: Product | { name: string; unit: string; id?: string }) => void
  onAddCustomProduct: () => void
}

export function ProductSearch({
  search, setSearch, suggestions, showSuggestions, setShowSuggestions,
  searching, searchRef, draftItems, filteredTop, availableCategories,
  selectedCategory, setSelectedCategory, onAddProduct, onAddCustomProduct,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => search.length >= 1 && setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions.length > 0) onAddProduct(suggestions[0])
              else if (e.key === 'Enter' && search.trim()) onAddCustomProduct()
            }}
            placeholder="Търси продукт..."
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
                <button key={p.id} onClick={() => onAddProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-[10px] text-white/30">{p.category} · {p.unit}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {p.last_price && <div className="text-xs text-white/50">{p.last_price.toFixed(2)}€</div>}
                    <div className="text-[10px] text-white/25">{p.order_count}× поръчван</div>
                  </div>
                </button>
              ))}
              {search.trim() && !suggestions.some(s => s.name.toLowerCase() === search.toLowerCase()) && (
                <button onClick={onAddCustomProduct}
                  className="w-full flex items-center px-4 py-3 hover:bg-white/5 text-left border-t border-white/[0.06]">
                  <span className="text-xs text-amber-400">+ Добави &quot;{search}&quot; като нов продукт</span>
                </button>
              )}
            </div>
          )}
        </div>
        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}
      </div>

      {/* Top products by category */}
      <div>
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-amber-400/15 text-amber-400' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {filteredTop.slice(0, 25).map(p => {
            const inDraft = draftItems.some(i => i.product_name === p.name)
            return (
              <button key={p.id} onClick={() => onAddProduct(p)}
                className={`text-left px-2.5 py-2 rounded-lg border transition-all ${
                  inDraft ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15'
                }`}>
                <div className="text-[11px] text-white/80 font-medium leading-tight line-clamp-2">{p.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-white/25">{p.order_count}×</span>
                  {inDraft && <span className="text-[9px] text-amber-400">✓</span>}
                </div>
              </button>
            )
          })}
          {filteredTop.length === 0 && (
            <div className="col-span-full text-center py-6 text-white/30 text-xs">Няма продукти</div>
          )}
        </div>
      </div>
    </div>
  )
}
