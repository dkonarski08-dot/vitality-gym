// app/(dashboard)/shifts/components/ShiftsHeader.tsx
import { Holiday } from '../utils'

interface Props {
  monthLabel: string
  holidays: Holiday[]
  userRole: string
  copying: boolean
  copyResult: string | null
  reorderMode: boolean
  savingOrder: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onCopyMonth: () => void
  onDeleteMonth: () => void
  onToggleReorder: () => void
  onSaveOrder: () => void
  onAddStaff: () => void
  onOpenSettings: () => void
}

export function ShiftsHeader({
  monthLabel, holidays, userRole,
  copying, copyResult, reorderMode, savingOrder,
  onPrevMonth, onNextMonth, onCopyMonth, onDeleteMonth,
  onToggleReorder, onSaveOrder, onAddStaff, onOpenSettings,
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Смени</h1>
          <p className="text-sm text-white/50 mt-0.5">Работен график</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {userRole === 'admin' && (<>
            <button onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white">⚙️</button>
            <button onClick={onCopyMonth} disabled={copying}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white disabled:opacity-30">
              {copying ? '...' : copyResult
                ? <span className="text-emerald-400">{copyResult}</span>
                : '📋 Копирай предходен'}
            </button>
            <button onClick={onDeleteMonth}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400/70 border border-red-500/20 hover:text-red-400">
              🗑 Изтрий месеца
            </button>
            <button onClick={onToggleReorder}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border ${
                reorderMode
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                  : 'bg-white/5 text-white/50 border-white/[0.08] hover:text-white'
              }`}>
              {reorderMode ? '✓ Готово' : '↕ Пренареди'}
            </button>
            {reorderMode && (
              <button onClick={onSaveOrder} disabled={savingOrder}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 disabled:opacity-40">
                {savingOrder ? '...' : '💾 Запази реда'}
              </button>
            )}
            <button onClick={onAddStaff}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/[0.08] hover:text-white">
              + Служител
            </button>
          </>)}
          <button onClick={onPrevMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">‹</button>
          <span className="text-sm font-semibold w-40 text-center text-white">{monthLabel}</span>
          <button onClick={onNextMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm">›</button>
        </div>
      </div>

      {userRole === 'admin' && holidays.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {holidays.map(h => (
            <div key={h.date} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1">
              <span className="text-[9px] text-red-400/70 font-mono">
                {new Date(h.date + 'T12:00:00').toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-[10px] text-red-400 font-medium">{h.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
