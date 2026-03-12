// app/(dashboard)/requests/components/DraftPanel.tsx
import { DraftItem } from '../types'

interface Props {
  items: DraftItem[]
  notes: string
  setNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
}

export function DraftPanel({
  items, notes, setNotes,
  saving, submitting,
  onUpdateQty, onRemoveItem, onSave, onSubmit,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-white/[0.02] border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <span className="text-sm font-semibold text-white">Чернова</span>
        {items.length > 0 && (
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">
            {items.length} продукта
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-xs text-white/30">Избери продукти от списъка вляво</div>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="flex-1 overflow-y-auto space-y-1 mb-4 min-h-0">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 group">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/80 truncate">{item.product_name}</div>
                  <div className="text-[10px] text-white/25">{item.unit}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdateQty(idx, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={e => onUpdateQty(idx, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-10 bg-transparent text-center text-xs text-white font-medium focus:outline-none"
                  />
                  <button
                    onClick={() => onUpdateQty(idx, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(idx)}
                  className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 text-xs transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Бележка за доставчика..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:border-amber-400/30 focus:outline-none resize-none placeholder:text-white/20 mb-3 shrink-0"
          />

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              {saving ? '...' : '💾 Запази'}
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-1">
                  <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  Изпращам...
                </span>
              ) : '🚀 Изпрати'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
