// app/(dashboard)/cash/components/CashHeader.tsx

interface Props {
  title: string
  subtitle: string
  saved?: boolean
}

export function CashHeader({ title, subtitle, saved }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
        </div>
        {saved && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ Записано
          </span>
        )}
      </div>
    </div>
  )
}
