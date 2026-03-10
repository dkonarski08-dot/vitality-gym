// app/(dashboard)/hall/components/ClientsTab.tsx
import { ClientVisit, NoShowClient, LapsedClient, monthLabel } from '../types'

interface Props {
  availableMonths: string[]
  periodFrom: string
  periodTo: string
  setPeriodFrom: (v: string) => void
  setPeriodTo: (v: string) => void
  filteredClients: ClientVisit[]
  filteredNoshows: NoShowClient[]
  newClients: ClientVisit[]
  lapsedClients: LapsedClient[]
  uniqueActiveClients: string[]
}

export function ClientsTab({
  availableMonths, periodFrom, periodTo, setPeriodFrom, setPeriodTo,
  filteredClients, filteredNoshows, newClients, lapsedClients, uniqueActiveClients,
}: Props) {
  return (
    <div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-3">Период за анализ</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">От:</span>
            <select value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none">
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">До:</span>
            <select value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none">
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m + '-01')}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            {[3, 6, 12].map(months => {
              const to = availableMonths[availableMonths.length - 1] || ''
              const fromDate = new Date(to + '-01')
              fromDate.setMonth(fromDate.getMonth() - months + 1)
              const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`
              return (
                <button key={months} onClick={() => { setPeriodFrom(from); setPeriodTo(to) }}
                  className="px-3 py-1.5 bg-white/[0.05] border border-white/10 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors">
                  Последни {months}м
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Активни клиенти', value: uniqueActiveClients.length, color: 'text-emerald-400', sub: 'посещавали в периода' },
          { label: 'Нови клиенти', value: newClients.length, color: 'text-sky-400', sub: 'първо посещение в периода' },
          { label: 'Отпаднали', value: lapsedClients.length, color: 'text-orange-400', sub: 'не са идвали 30+ дни' },
          { label: 'No-shows', value: filteredNoshows.reduce((a, c) => a + c.total_noshows, 0), color: 'text-red-400', sub: 'резервации без присъствие' },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wide">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-white/30 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">🏆 Топ 15 — Най-редовни</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {filteredClients.slice(0, 15).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/30 w-5 font-mono">{i + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{c.client_name}</div>
                    <div className="text-xs text-white/40">{c.class_name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-violet-400">{c.total_visits} посещения</div>
                  <div className="text-xs text-white/40">{c.months_active} месеца</div>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма данни за периода</div>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">⚠️ Топ No-shows</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {filteredNoshows.slice(0, 15).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/30 w-5 font-mono">{i + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{c.client_name}</div>
                    <div className="text-xs text-white/40">{c.class_name}</div>
                    {c.client_phone && <div className="text-xs text-sky-400 mt-0.5">📞 {c.client_phone}</div>}
                    <div className="text-xs text-white/30">Последен: {c.last_noshow ? monthLabel(c.last_noshow) : '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-400">{c.total_noshows} no-show</div>
                  <div className="text-xs text-white/40">{c.noshow_percent}% от резервации</div>
                </div>
              </div>
            ))}
            {filteredNoshows.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма no-shows за периода</div>}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">📉 Отпаднали клиенти — не са идвали 30+ дни</h3>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-wide">
            <div>Клиент</div><div>Последно посещение</div><div>Класове</div><div>Общо посещения</div>
          </div>
          {lapsedClients.map((c, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-white/[0.06] items-center hover:bg-white/[0.02] transition-colors">
              <div className="text-sm font-medium text-white">{c.client_name}</div>
              <div className="text-sm text-orange-400">{c.last_seen ? monthLabel(c.last_seen) : '—'}</div>
              <div className="text-xs text-white/40">{c.classes}</div>
              <div className="text-sm text-white/70">{c.total_visits}</div>
            </div>
          ))}
          {lapsedClients.length === 0 && <div className="text-center text-white/30 py-8 text-sm">Няма отпаднали клиенти</div>}
        </div>
      </div>
    </div>
  )
}
