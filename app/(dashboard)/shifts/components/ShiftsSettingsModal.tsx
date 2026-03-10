// app/(dashboard)/shifts/components/ShiftsSettingsModal.tsx
import { GymSettings } from '../utils'

interface Props {
  settingsForm: GymSettings
  savingSettings: boolean
  setSettingsForm: (s: GymSettings) => void
  onSave: () => void
  onClose: () => void
}

type DayConfig = {
  label: string
  openKey: keyof GymSettings
  closeKey: keyof GymSettings
  extraKey: 'weekday_shift_duration_minutes' | 'saturday_shifts' | 'sunday_shifts'
  extraLabel: string
  extraType: 'number' | 'select'
}

const DAY_CONFIGS: DayConfig[] = [
  { label: 'Понеделник — Петък', openKey: 'weekday_open', closeKey: 'weekday_close', extraKey: 'weekday_shift_duration_minutes', extraLabel: 'Смяна (мин)', extraType: 'number' },
  { label: 'Събота', openKey: 'saturday_open', closeKey: 'saturday_close', extraKey: 'saturday_shifts', extraLabel: 'Смени', extraType: 'select' },
  { label: 'Неделя', openKey: 'sunday_open', closeKey: 'sunday_close', extraKey: 'sunday_shifts', extraLabel: 'Смени', extraType: 'select' },
]

export function ShiftsSettingsModal({ settingsForm, savingSettings, setSettingsForm, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-5">Работно време</div>
        <div className="space-y-4 mb-5">
          {DAY_CONFIGS.map(({ label, openKey, closeKey, extraKey, extraLabel, extraType }) => (
            <div key={label}>
              <div className="text-xs text-white/70 mb-2">{label}</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Отваря</label>
                  <input type="time" value={(settingsForm[openKey] as string)?.slice(0, 5)}
                    onChange={e => setSettingsForm({ ...settingsForm, [openKey]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Затваря</label>
                  <input type="time" value={(settingsForm[closeKey] as string)?.slice(0, 5)}
                    onChange={e => setSettingsForm({ ...settingsForm, [closeKey]: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">{extraLabel}</label>
                  {extraType === 'number' ? (
                    <input type="number" value={settingsForm[extraKey] as number}
                      onChange={e => setSettingsForm({ ...settingsForm, [extraKey]: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none" />
                  ) : (
                    <select value={settingsForm[extraKey] as number}
                      onChange={e => setSettingsForm({ ...settingsForm, [extraKey]: parseInt(e.target.value) })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
                      <option value={1}>1 (цял ден)</option>
                      <option value={2}>2 (първа/втора)</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={onSave} disabled={savingSettings}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {savingSettings ? '...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
