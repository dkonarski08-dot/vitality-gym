export default function DiffBadge({ a, b }: { a: number | null; b: number | null }) {
  if (a == null || b == null) return <span className="text-white/30">—</span>
  const diff = a - b
  const color = Math.abs(diff) <= 1 ? 'text-emerald-400' : Math.abs(diff) <= 5 ? 'text-amber-400' : 'text-red-400'
  return <span className={`font-medium ${color}`}>{diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}€`}</span>
}
