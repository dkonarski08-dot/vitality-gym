// app/(dashboard)/hall/components/HallHeader.tsx
import { monthLabel, TabKey } from '../types'

const TABS = [
  { key: 'attendance' as TabKey, label: '📊 Месечни данни' },
  { key: 'yearly' as TabKey, label: '📅 Година' },
  { key: 'reconciliation' as TabKey, label: '🔄 Reconciliation' },
  { key: 'clients' as TabKey, label: '👥 Клиенти' },
  { key: 'import' as TabKey, label: '📥 Import' },
  { key: 'config' as TabKey, label: '⚙️ Настройки' },
]

interface Props {
  selectedMonth: string
  isLocked: boolean
  activeTab: TabKey
  onPrevMonth: () => void
  onNextMonth: () => void
  onToggleLock: () => void
  onTabChange: (tab: TabKey) => void
}

export function HallHeader({ selectedMonth, isLocked, activeTab, onPrevMonth, onNextMonth, onToggleLock, onTabChange }: Props) {
  return (
    <>
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Vitality Hall</h1>
            <p className="text-sm text-white/60 mt-0.5">Групови тренировки · {monthLabel(selectedMonth)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">🔒 Заключен</span>}
            <button onClick={onPrevMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">‹</button>
            <span className="text-sm font-semibold w-36 text-center text-white">{monthLabel(selectedMonth)}</span>
            <button onClick={onNextMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">›</button>
            <button onClick={onToggleLock} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isLocked ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25' : 'bg-white/[0.05] text-white/60 border-white/10 hover:bg-white/10'
            }`}>
              {isLocked ? '🔓 Отключи' : '🔒 Заключи'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex border-b border-white/[0.06] px-6 overflow-x-auto bg-[#060609]">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'border-violet-400 text-violet-400' : 'border-transparent text-white/40 hover:text-white/70'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )
}
