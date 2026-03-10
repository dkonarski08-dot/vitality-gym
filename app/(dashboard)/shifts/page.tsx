// app/(dashboard)/shifts/page.tsx
'use client'

import { useShifts } from './hooks/useShifts'
import { ShiftsHeader } from './components/ShiftsHeader'
import { StaffSummaryCards } from './components/StaffSummaryCards'
import { ShiftsCalendarGrid } from './components/ShiftsCalendarGrid'
import { ShiftEditModal } from './components/ShiftEditModal'
import { StaffModal } from './components/StaffModal'
import { ShiftsSettingsModal } from './components/ShiftsSettingsModal'
import { MissingShifts } from './components/MissingShifts'
import { ReceptionistWeekView } from '@/components/shifts/ReceptionistWeekView'

export default function ShiftsPage() {
  const s = useShifts()

  return (
    <div className="min-h-screen">
      <ShiftsHeader
        monthLabel={s.monthLabel}
        holidays={s.holidays}
        userRole={s.userRole}
        copying={s.copying}
        copyResult={s.copyResult}
        reorderMode={s.reorderMode}
        savingOrder={s.savingOrder}
        onPrevMonth={s.prevMonth}
        onNextMonth={s.nextMonth}
        onCopyMonth={s.handleCopyMonth}
        onDeleteMonth={() => s.setShowDeleteMonth(true)}
        onToggleReorder={() => s.setReorderMode(r => !r)}
        onSaveOrder={s.handleSaveOrder}
        onAddStaff={() => s.setShowAddStaff(true)}
        onOpenSettings={() => { s.setSettingsForm(s.settings); s.setShowSettings(true) }}
      />

      <div className="p-6">
        {s.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (<>
          {s.userRole === 'receptionist' ? (
            <ReceptionistWeekView
              staff={s.staff}
              shifts={s.shifts}
              year={s.year}
              month={s.month}
              days={s.days}
              today={s.today}
            />
          ) : (<>
            {s.reorderMode && (
              <div className="mb-3 flex items-center gap-2 bg-amber-400/[0.04] border border-amber-400/10 rounded-xl px-4 py-2.5">
                <span className="text-[11px] text-amber-400/80">↕ Плъзни картите за да промениш реда на служителите в таблицата</span>
              </div>
            )}

            <StaffSummaryCards
              staffSummary={s.staffSummary}
              reorderMode={s.reorderMode}
              draggedStaffId={s.draggedStaffId}
              userRole={s.userRole}
              onEdit={s.setEditStaff}
              onDragStart={s.setDraggedStaffId}
              onDrop={s.handleReorderDrop}
            />

            <ShiftsCalendarGrid
              staff={s.staff}
              days={s.days}
              year={s.year}
              month={s.month}
              today={s.today}
              userRole={s.userRole}
              editCell={s.editCell}
              getShift={s.getShift}
              getHoliday={s.getHoliday}
              onCellClick={s.handleCellClick}
            />

            <MissingShifts missingByDate={s.missingByDate} />
          </>)}
        </>)}
      </div>

      {/* Modals */}
      {s.editCell && s.settings && (
        <ShiftEditModal
          editCell={s.editCell}
          settings={s.settings}
          staff={s.staff}
          editMode={s.editMode}
          editPreset={s.editPreset}
          editStart={s.editStart}
          editEnd={s.editEnd}
          editLeaveType={s.editLeaveType}
          wholeWeek={s.wholeWeek}
          saving={s.saving}
          bulkSaving={s.bulkSaving}
          setEditMode={s.setEditMode}
          setEditStart={s.setEditStart}
          setEditEnd={s.setEditEnd}
          setEditLeaveType={s.setEditLeaveType}
          setWholeWeek={s.setWholeWeek}
          onPresetSelect={s.handlePresetSelect}
          onSave={s.handleSaveShift}
          onDelete={s.handleDeleteShift}
          onClose={() => { s.setEditCell(null); s.setWholeWeek(false) }}
          getShift={s.getShift}
          getHoliday={s.getHoliday}
        />
      )}

      {s.showAddStaff && (
        <StaffModal
          mode="add"
          saving={false}
          onSubmit={s.handleAddStaff}
          onClose={() => s.setShowAddStaff(false)}
        />
      )}

      {s.editStaff && (
        <StaffModal
          mode="edit"
          staff={s.editStaff}
          saving={s.savingStaff}
          onSubmit={(name, role, phone) => s.handleSaveStaff(name, role, phone)}
          onToggleActive={() => s.handleToggleStaffActive(s.editStaff!)}
          onClose={() => s.setEditStaff(null)}
        />
      )}

      {s.showSettings && s.settingsForm && (
        <ShiftsSettingsModal
          settingsForm={s.settingsForm}
          savingSettings={s.savingSettings}
          setSettingsForm={s.setSettingsForm}
          onSave={s.handleSaveSettings}
          onClose={() => s.setShowSettings(false)}
        />
      )}

      {s.showDeleteMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !s.deletingMonth && s.setShowDeleteMonth(false)}>
          <div className="bg-[#0f0f14] border border-red-500/20 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-lg">🗑</div>
              <div>
                <div className="text-sm font-semibold text-white">Изтрий всички смени</div>
                <div className="text-xs text-white/40 mt-0.5">{s.monthLabel}</div>
              </div>
            </div>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Това ще изтрие <span className="text-red-400 font-medium">всички {s.shifts.length} смени</span> за {s.monthLabel}. Действието не може да бъде отменено.
            </p>
            <div className="flex gap-2">
              <button onClick={() => s.setShowDeleteMonth(false)} disabled={s.deletingMonth}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06] disabled:opacity-40">Откажи</button>
              <button onClick={s.handleDeleteMonth} disabled={s.deletingMonth}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25 disabled:opacity-40">
                {s.deletingMonth ? '...' : 'Изтрий всички'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
