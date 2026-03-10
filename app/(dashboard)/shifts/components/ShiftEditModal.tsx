// app/(dashboard)/shifts/components/ShiftEditModal.tsx
import { Staff, Shift, Holiday, GymSettings, LEAVE_TYPES, getShiftTimes, calcHours } from '../utils'

interface Props {
  editCell: { staffId: string; date: string }
  settings: GymSettings
  staff: Staff[]
  editMode: 'shift' | 'leave'
  editPreset: string
  editStart: string
  editEnd: string
  editLeaveType: string
  wholeWeek: boolean
  saving: boolean
  bulkSaving: boolean
  setEditMode: (m: 'shift' | 'leave') => void
  setEditStart: (v: string) => void
  setEditEnd: (v: string) => void
  setEditLeaveType: (v: string) => void
  setWholeWeek: (v: boolean | ((prev: boolean) => boolean)) => void
  onPresetSelect: (type: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  getShift: (staffId: string, date: string) => Shift | undefined
  getHoliday: (date: string) => Holiday | undefined
}

export function ShiftEditModal({
  editCell, settings, staff,
  editMode, editPreset, editStart, editEnd, editLeaveType, wholeWeek,
  saving, bulkSaving,
  setEditMode, setEditStart, setEditEnd, setEditLeaveType, setWholeWeek,
  onPresetSelect, onSave, onDelete, onClose,
  getShift, getHoliday,
}: Props) {
  const staffMember = staff.find(s => s.id === editCell.staffId)
  const holiday = getHoliday(editCell.date)
  const hasExisting = !!getShift(editCell.staffId, editCell.date)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-1">{staffMember?.name}</div>
        <div className="text-xs text-white/40 mb-4">
          {new Date(editCell.date + 'T12:00:00').toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
          {holiday && (
            <span className="ml-2 inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 text-red-400">
              🎄 {holiday.name}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-4 bg-white/[0.03] rounded-lg p-1">
          <button onClick={() => setEditMode('shift')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${editMode === 'shift' ? 'bg-amber-400/10 text-amber-400' : 'text-white/40'}`}>Смяна</button>
          <button onClick={() => setEditMode('leave')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${editMode === 'leave' ? 'bg-amber-400/10 text-amber-400' : 'text-white/40'}`}>Отсъствие</button>
        </div>

        {editMode === 'shift' ? (<>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['first', 'second', 'full'] as const).map(type => {
              const times = getShiftTimes(settings, new Date(editCell.date + 'T12:00:00').getDay(), type)
              const label = type === 'first' ? 'Първа' : type === 'second' ? 'Втора' : 'Цял ден'
              return (
                <button key={type} onClick={() => onPresetSelect(type)}
                  className={`py-2 rounded-xl text-xs font-medium border ${editPreset === type ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06] text-white/60'}`}>
                  <div>{label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{times.start}-{times.end}</div>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">От</label>
              <input type="time" value={editStart} onChange={e => { setEditStart(e.target.value); onPresetSelect('custom') }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">До</label>
              <input type="time" value={editEnd} onChange={e => { setEditEnd(e.target.value); onPresetSelect('custom') }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          </div>
          <div className="text-xs text-white/50 text-center mb-3">{calcHours(editStart, editEnd).toFixed(1)} часа</div>
          {editPreset === 'none' && (
            <p className="text-[10px] text-white/30 text-center -mt-2 mb-3">Избери смяна или въведи часове</p>
          )}
          <button onClick={() => setWholeWeek(w => !w)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-4 transition-all ${
              wholeWeek ? 'bg-amber-400/10 border-amber-400/25 text-amber-400' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
            }`}>
            <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${wholeWeek ? 'bg-amber-400 border-amber-400' : 'border-white/20 bg-white/5'}`}>
              {wholeWeek && <span className="text-[9px] text-black font-bold">✓</span>}
            </div>
            <span className="text-xs font-medium">Цяла седмица (Пон–Пет)</span>
          </button>
        </>) : (
          <div className="space-y-2 mb-4">
            {LEAVE_TYPES.map(leave => (
              <button key={leave.type} onClick={() => setEditLeaveType(leave.type)}
                className={`w-full py-3 rounded-xl text-xs font-medium border ${editLeaveType === leave.type ? leave.color + ' ring-1 ring-white/10' : 'bg-white/[0.03] border-white/[0.06] text-white/60'}`}>
                {leave.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {hasExisting && !wholeWeek && (
            <button onClick={onDelete} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Изтрий</button>
          )}
          <button onClick={() => { onClose(); setWholeWeek(false) }} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={onSave} disabled={saving || bulkSaving} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {(saving || bulkSaving) ? '...' : wholeWeek ? '⚡ Попълни седмица' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
