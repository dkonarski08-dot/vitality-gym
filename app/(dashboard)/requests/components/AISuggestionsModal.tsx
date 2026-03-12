// app/(dashboard)/requests/components/AISuggestionsModal.tsx

interface SuggestedProduct {
  name: string
  unit: string
}

interface Props {
  open: boolean
  prose: string
  suggestions: SuggestedProduct[]
  onAddAndSubmit: (products: SuggestedProduct[]) => void
  onSubmitWithout: () => void
  onDismiss: () => void
}

export function AISuggestionsModal({ open, prose, suggestions, onAddAndSubmit, onSubmitWithout, onDismiss }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-sm font-semibold text-white">AI предложения</h3>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-amber-400/80 mb-4">{prose}</p>

          {suggestions.length > 0 && (
            <div className="space-y-2 mb-4">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-[10px] text-amber-400/60">+</span>
                  <span className="text-xs text-white/80 flex-1">{s.name}</span>
                  <span className="text-[10px] text-white/30">{s.unit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {suggestions.length > 0 && (
              <button
                onClick={() => onAddAndSubmit(suggestions)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 transition-opacity"
              >
                Добави всички и изпрати
              </button>
            )}
            <button
              onClick={onSubmitWithout}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
            >
              Изпрати без промяна
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
