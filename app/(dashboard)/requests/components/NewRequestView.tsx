// app/(dashboard)/requests/components/NewRequestView.tsx
import { DeliveryProduct, DraftItem } from '../types'
import { ProductPicker } from './ProductPicker'
import { DraftPanel } from './DraftPanel'

interface Props {
  month: string              // YYYY-MM
  userRole: string
  topProducts: DeliveryProduct[]
  draftItems: DraftItem[]
  draftNotes: string
  setDraftNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  onAddProduct: (name: string, unit: string, productId: string | null) => void
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
  onBack: () => void
  onShowHistory: () => void   // admin only
}

const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return `${MONTHS_BG[parseInt(m) - 1]} ${year}`
}

export function NewRequestView({
  month, userRole, topProducts, draftItems, draftNotes, setDraftNotes,
  saving, submitting,
  onAddProduct, onUpdateQty, onRemoveItem, onSave, onSubmit, onBack, onShowHistory,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <button onClick={onBack} className="text-sm text-white/40 hover:text-white/70 transition-colors shrink-0">
            ← Назад
          </button>
          <h1 className="text-base font-bold text-white truncate">
            Нова заявка — {formatMonth(month)}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {userRole === 'admin' && (
              <button
                onClick={onShowHistory}
                className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:text-white/60 transition-colors"
              >
                История →
              </button>
            )}
            <button
              onClick={onSubmit}
              disabled={submitting || draftItems.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? '...' : '🚀 Изпрати заявката'}
            </button>
          </div>
        </div>
      </div>

      {/* Content — 60/40 split */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Product picker — 60% */}
        <div className="lg:w-[60%] p-6 lg:border-r border-white/[0.06]">
          <ProductPicker
            topProducts={topProducts}
            draftItems={draftItems}
            onAddProduct={onAddProduct}
          />
        </div>

        {/* Draft panel — 40% */}
        <div className="lg:w-[40%] p-6 lg:sticky lg:top-[73px] lg:self-start lg:max-h-[calc(100vh-73px)] lg:overflow-hidden flex flex-col">
          <DraftPanel
            items={draftItems}
            notes={draftNotes}
            setNotes={setDraftNotes}
            saving={saving}
            submitting={submitting}
            onUpdateQty={onUpdateQty}
            onRemoveItem={onRemoveItem}
            onSave={onSave}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
