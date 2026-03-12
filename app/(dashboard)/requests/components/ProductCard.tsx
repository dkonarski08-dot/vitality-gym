// app/(dashboard)/requests/components/ProductCard.tsx

interface Props {
  name: string          // already resolved: clean_name ?? name
  orderCount?: number
  inDraft: boolean
  onClick: () => void
}

export function ProductCard({ name, orderCount, inDraft, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-2.5 py-2.5 rounded-lg border transition-all w-full ${
        inDraft
          ? 'bg-amber-500/10 border-amber-500/25'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]'
      }`}
    >
      <div className="text-[11px] text-white/85 font-medium leading-tight line-clamp-2 mb-1.5">
        {name}
      </div>
      <div className="flex items-center justify-between">
        {orderCount !== undefined && (
          <span className="text-[9px] text-white/25">{orderCount}×</span>
        )}
        {inDraft && <span className="text-[9px] text-amber-400 ml-auto">✓</span>}
      </div>
    </button>
  )
}
