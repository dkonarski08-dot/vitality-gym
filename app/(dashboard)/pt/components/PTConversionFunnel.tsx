// app/(dashboard)/pt/components/PTConversionFunnel.tsx
'use client'

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  facebook:  { label: '📘 Фейсбук',  color: '#4267B2' },
  instagram: { label: '📸 Инстаграм', color: '#E1306C' },
  google:    { label: '🔍 Гугъл',     color: '#fbbf24' },
  friend:    { label: '👥 Приятел',   color: '#34d399' },
  nearby:    { label: '📍 Наблизо',   color: '#a78bfa' },
}

interface Props {
  inquiryCount: number
  wonInquiries: number
  lostInquiries: number
  activeInquiries: number
  closedInquiries: number
  conversionPct: number
  convTrend: string | null
  convTrendUp: boolean
  sortedSources: [string, number][]
  totalWithSource: number
}

export default function PTConversionFunnel({
  inquiryCount,
  wonInquiries,
  lostInquiries,
  activeInquiries,
  closedInquiries,
  conversionPct,
  convTrend,
  convTrendUp,
  sortedSources,
  totalWithSource,
}: Props) {
  return (
    <>
      {/* ── Спечелени клиенти (Conversion) ── */}
      {inquiryCount > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Спечелени клиенти</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{conversionPct}%</span>
                <span className="text-[11px] text-white/35">{wonInquiries} от {inquiryCount} запитвания</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-emerald-400 font-semibold">{wonInquiries}</span>
                  <span className="text-white/35">спечелени</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  <span className="text-red-400 font-semibold">{lostInquiries}</span>
                  <span className="text-white/35">загубени</span>
                </span>
                {activeInquiries > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    <span className="text-amber-400 font-semibold">{activeInquiries}</span>
                    <span className="text-white/35">активни</span>
                  </span>
                )}
              </div>
            </div>
            {convTrend && (
              <div className={`text-xs font-semibold shrink-0 ${convTrendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {convTrend}
              </div>
            )}
          </div>
          {closedInquiries > 0 && (
            <div className="mt-3 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${conversionPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Откъде разбраха за нас ── */}
      {sortedSources.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Откъде разбраха за нас</div>
          <div className="space-y-2.5">
            {sortedSources.map(([key, count]) => {
              const cfg = SOURCE_CONFIG[key] || { label: key, color: '#ffffff' }
              const pct = totalWithSource > 0 ? Math.round((count / totalWithSource) * 100) : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-[11px] text-white/55 w-[90px] shrink-0">{cfg.label}</span>
                  <div className="flex-1 h-[5px] bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: cfg.color, opacity: 0.75 }}
                    />
                  </div>
                  <span className="text-[11px] text-white/40 w-8 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
