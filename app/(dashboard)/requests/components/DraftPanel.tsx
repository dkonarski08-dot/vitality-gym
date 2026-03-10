// app/(dashboard)/requests/components/DraftPanel.tsx
import { RequestItem } from '../types'

interface Props {
  draftItems: RequestItem[]
  draftNotes: string
  setDraftNotes: (v: string) => void
  saving: boolean
  submitting: boolean
  aiSuggestion: string | null
  setAiSuggestion: (v: string | null) => void
  onUpdateQty: (idx: number, qty: number) => void
  onRemoveItem: (idx: number) => void
  onSave: () => void
  onSubmit: () => void
}

export function DraftPanel({
  draftItems, draftNotes, setDraftNotes,
  saving, submitting, aiSuggestion, setAiSuggestion,
  onUpdateQty, onRemoveItem, onSave, onSubmit,
}: Props) {
  return (
    <div className="sticky top-[80px] bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Текуща заявка</div>
        {draftItems.length > 0 && (
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">{draftItems.length} продукта</span>
        )}
      </div>

      {aiSuggestion && (
        <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-lg p-3 mb-4 text-xs text-amber-400/80">
          🤖 {aiSuggestion}
          <button onClick={() => setAiSuggestion(null)} className="text-white/30 ml-2 hover:text-white/50">✕</button>
        </div>
      )}

      {draftItems.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-xs text-white/30">Търси или избери продукти от списъка</div>
        </div>
      ) : (<>
        <div className="space-y-1 mb-4 max-h-[400px] overflow-y-auto">
          {draftItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 group">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/80 truncate">{item.product_name}</div>
                <div className="text-[10px] text-white/25">{item.unit}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onUpdateQty(idx, item.quantity - 1)}
                  className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs">−</button>
                <input
                  type="number" min="0" step="1" value={item.quantity}
                  onChange={e => onUpdateQty(idx, parseFloat(e.target.value) || 0)}
                  className="w-10 bg-transparent text-center text-xs text-white font-medium focus:outline-none"
                />
                <button onClick={() => onUpdateQty(idx, item.quantity + 1)}
                  className="w-6 h-6 rounded bg-white/5 text-white/40 hover:text-white flex items-center justify-center text-xs">+</button>
              </div>
              <button onClick={() => onRemoveItem(idx)}
                className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 text-xs transition-opacity">✕</button>
            </div>
          ))}
        </div>

        <textarea
          value={draftNotes}
          onChange={e => setDraftNotes(e.target.value)}
          placeholder="Бележка за доставчика..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:border-amber-400/30 focus:outline-none resize-none placeholder:text-white/20 mb-3"
        />

        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 disabled:opacity-30">
            {saving ? '...' : '💾 Запази'}
          </button>
          <button onClick={onSubmit} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30">
            {submitting ? (
              <span className="flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                Изпращам...
              </span>
            ) : '📤 Изпрати'}
          </button>
        </div>
      </>)}
    </div>
  )
}
