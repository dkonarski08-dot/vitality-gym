// app/(dashboard)/shifts/components/StaffSummaryCards.tsx
import { Staff, STAFF_ROLES, roleGradient } from '../utils'
import { StaffSummary } from '../hooks/useShifts'

interface Props {
  staffSummary: StaffSummary[]
  reorderMode: boolean
  draggedStaffId: string | null
  userRole: string
  onEdit: (s: Staff) => void
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
}

export function StaffSummaryCards({
  staffSummary, reorderMode, draggedStaffId, userRole, onEdit, onDragStart, onDrop,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      {staffSummary.map(s => (
        <div key={s.id}
          onClick={() => !reorderMode && userRole === 'admin' && onEdit(s)}
          draggable={reorderMode}
          onDragStart={() => onDragStart(s.id)}
          onDragOver={e => { if (reorderMode) e.preventDefault() }}
          onDrop={() => reorderMode && onDrop(s.id)}
          className={`bg-white/[0.02] border rounded-xl p-3 transition-all ${
            reorderMode
              ? 'border-amber-400/20 cursor-grab active:cursor-grabbing select-none'
              : 'border-white/[0.06] cursor-pointer hover:border-white/[0.12]'
          } ${draggedStaffId === s.id ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${roleGradient(s.role)} flex items-center justify-center text-[10px] font-bold text-[#0a0a0f]`}>
              {s.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{s.name}</div>
              <div className="text-[9px] text-white/40">{STAFF_ROLES.find(r => r.value === s.role)?.label || s.role}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-white/50">Смени</div><div className="text-right text-white font-medium">{s.totalShifts}</div>
            <div className="text-white/50">Часове</div><div className="text-right text-white font-medium">{s.totalHours.toFixed(1)}ч</div>
            {s.weekendShifts > 0 && <><div className="text-white/50">Уикенд</div><div className="text-right text-white/80">{s.weekendShifts}</div></>}
            {s.sickDays > 0 && <><div className="text-red-400/70">Болничен</div><div className="text-right text-red-400">{s.sickDays}д</div></>}
            {s.paidLeave > 0 && <><div className="text-blue-400/70">Отпуск</div><div className="text-right text-blue-400">{s.paidLeave}д</div></>}
          </div>
        </div>
      ))}
    </div>
  )
}
