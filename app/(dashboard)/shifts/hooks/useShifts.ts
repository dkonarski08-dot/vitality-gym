// app/(dashboard)/shifts/hooks/useShifts.ts
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { MONTHS_BG } from '@/lib/formatters'
import { useSession } from '@/hooks/useSession'
import {
  Staff, Shift, Holiday, GymSettings,
  LEAVE_TYPES, calcHours, getDaysInMonth, getShiftTimes,
} from '../utils'

export interface StaffSummary extends Staff {
  totalShifts: number
  totalHours: number
  weekendShifts: number
  sickDays: number
  paidLeave: number
}

export interface MissingDay {
  date: string
  day: Date
  missing: Staff[]
}

export function useShifts() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [staff, setStaff] = useState<Staff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [settings, setSettings] = useState<GymSettings | null>(null)
  const { userRole, userName, employeeId } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit shift modal
  const [editCell, setEditCell] = useState<{ staffId: string; date: string } | null>(null)
  const [editMode, setEditMode] = useState<'shift' | 'leave'>('shift')
  const [editPreset, setEditPreset] = useState<string>('none')
  const [editStart, setEditStart] = useState('06:30')
  const [editEnd, setEditEnd] = useState('14:45')
  const [editLeaveType, setEditLeaveType] = useState('sick')
  const [wholeWeek, setWholeWeek] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  // Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [editStaff, setEditStaff] = useState<Staff | null>(null)
  const [savingStaff, setSavingStaff] = useState(false)

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState<GymSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Copy / delete month
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<string | null>(null)
  const [showDeleteMonth, setShowDeleteMonth] = useState(false)
  const [deletingMonth, setDeletingMonth] = useState(false)

  // Reorder
  const [reorderMode, setReorderMode] = useState(false)
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [year, month] = currentMonth.split('-').map(Number)
  const days = useMemo(() => getDaysInMonth(year, month - 1), [year, month])
  const monthLabel = `${MONTHS_BG[month - 1]} ${year}`
  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [shiftRes, settRes, holRes] = await Promise.all([
      fetch(`/api/shifts?month=${currentMonth}`),
      fetch('/api/shifts?type=settings'),
      fetch(`/api/shifts?type=holidays&month=${currentMonth}`),
    ])
    const [shiftData, settData, holData] = await Promise.all([
      shiftRes.json(), settRes.json(), holRes.json(),
    ])
    setStaff(shiftData.staff || [])
    setShifts(shiftData.shifts || [])
    setSettings(settData.settings || null)
    setHolidays(holData.holidays || [])
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])

  const getShift = useCallback((staffId: string, date: string) =>
    shifts.find(s => s.staff_id === staffId && s.date === date), [shifts])

  const getHoliday = useCallback((date: string) =>
    holidays.find(h => h.date === date), [holidays])

  const missingByDate = useMemo((): MissingDay[] =>
    days
      .filter(day => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        if (dateStr > today) return false
        const dow = day.getDay()
        if (dow === 0 || dow === 6) return false
        return staff.some(s => !getShift(s.id, dateStr))
      })
      .map(day => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        return { date: dateStr, day, missing: staff.filter(s => !getShift(s.id, dateStr)) }
      })
      .filter(d => d.missing.length > 0),
  [days, year, month, today, staff, getShift])

  const staffSummary = useMemo((): StaffSummary[] => staff.map(s => {
    const ss = shifts.filter(sh => sh.staff_id === s.id)
    const workShifts = ss.filter(sh => !LEAVE_TYPES.some(l => l.type === sh.shift_type))
    const totalHours = workShifts.reduce((a, sh) => a + calcHours(sh.start_time, sh.end_time), 0)
    const weekendShifts = workShifts.filter(sh => {
      const d = new Date(sh.date).getDay()
      return d === 0 || d === 6
    }).length
    const sickDays = ss.filter(sh => sh.shift_type === 'sick').length
    const paidLeave = ss.filter(sh => sh.shift_type === 'paid_leave').length
    return { ...s, totalShifts: workShifts.length, totalHours, weekendShifts, sickDays, paidLeave }
  }), [staff, shifts])

  const handleCellClick = useCallback((staffId: string, date: string) => {
    if (userRole !== 'admin') return
    setWholeWeek(false)
    const existing = getShift(staffId, date)
    const d = new Date(date + 'T12:00:00')
    if (existing) {
      const isLeave = LEAVE_TYPES.some(l => l.type === existing.shift_type)
      if (isLeave) { setEditMode('leave'); setEditLeaveType(existing.shift_type) }
      else {
        setEditMode('shift'); setEditPreset(existing.shift_type)
        setEditStart(existing.start_time.slice(0, 5)); setEditEnd(existing.end_time.slice(0, 5))
      }
    } else if (settings) {
      setEditMode('shift'); setEditPreset('none')
      const times = getShiftTimes(settings, d.getDay(), 'first')
      setEditStart(times.start); setEditEnd(times.end)
    }
    setEditCell({ staffId, date })
  }, [userRole, getShift, settings])

  const handlePresetSelect = useCallback((type: string) => {
    if (!settings || !editCell) return
    if (editPreset === type) { setEditPreset('none'); return }
    setEditPreset(type)
    if (type === 'first' || type === 'second' || type === 'full') {
      const d = new Date(editCell.date + 'T12:00:00')
      const times = getShiftTimes(settings, d.getDay(), type as 'first' | 'second' | 'full')
      setEditStart(times.start); setEditEnd(times.end)
    }
  }, [settings, editCell, editPreset])

  const handleBulkAssign = useCallback(async (
    staffId: string, date: string, shiftType: string, start: string, end: string
  ) => {
    if (!settings) return
    setBulkSaving(true)
    const d = new Date(date + 'T12:00:00')
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dow - 1))
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_weekdays', staff_id: staffId, month: currentMonth,
        shift_type: shiftType, start_time: start, end_time: end,
        week_monday: monday.toISOString().split('T')[0],
      }),
    })
    setBulkSaving(false)
  }, [settings, currentMonth])

  const handleSaveShift = useCallback(async () => {
    if (!editCell) return
    setSaving(true)
    let start = editStart, end = editEnd, shiftType = editPreset
    if (editMode === 'leave') { start = '00:00'; end = '00:00'; shiftType = editLeaveType }
    if (wholeWeek && editMode === 'shift') {
      await handleBulkAssign(editCell.staffId, editCell.date, shiftType, start, end)
    } else {
      await fetch('/api/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: editCell.staffId, date: editCell.date,
          start_time: start, end_time: end, shift_type: shiftType,
        }),
      })
    }
    await loadData(); setSaving(false); setEditCell(null); setWholeWeek(false)
  }, [editCell, editStart, editEnd, editPreset, editMode, editLeaveType, wholeWeek, handleBulkAssign, loadData])

  const handleDeleteShift = useCallback(async () => {
    if (!editCell) return
    setSaving(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', staff_id: editCell.staffId, date: editCell.date }),
    })
    await loadData(); setSaving(false); setEditCell(null)
  }, [editCell, loadData])

  const handleDeleteMonth = useCallback(async () => {
    setDeletingMonth(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_month', month: currentMonth }),
    })
    setShowDeleteMonth(false); setDeletingMonth(false); await loadData()
  }, [currentMonth, loadData])

  const handleAddStaff = useCallback(async (name: string, role: string, phone: string) => {
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_staff', name, role, phone: phone || null }),
    })
    setShowAddStaff(false); await loadData()
  }, [loadData])

  const handleSaveStaff = useCallback(async (name: string, role: string, phone: string) => {
    if (!editStaff) return
    setSavingStaff(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_staff', staff_id: editStaff.id, name, role, phone: phone || null }),
    })
    setEditStaff(null); await loadData(); setSavingStaff(false)
  }, [editStaff, loadData])

  const handleToggleStaffActive = useCallback(async (s: Staff) => {
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_staff', staff_id: s.id, active: !s.active }),
    })
    setEditStaff(null); await loadData()
  }, [loadData])

  const handleCopyMonth = useCallback(async () => {
    setCopying(true); setCopyResult(null)
    const res = await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy_month', target_month: currentMonth }),
    })
    const data = await res.json()
    setCopyResult(data.count > 0
      ? `✓ Копирани ${data.count} смени`
      : data.message || 'Няма смени за копиране')
    await loadData(); setCopying(false)
    setTimeout(() => setCopyResult(null), 4000)
  }, [currentMonth, loadData])

  const handleSaveSettings = useCallback(async () => {
    if (!settingsForm) return
    setSavingSettings(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', ...settingsForm }),
    })
    setShowSettings(false); await loadData(); setSavingSettings(false)
  }, [settingsForm, loadData])

  const handleReorderDrop = useCallback((targetId: string) => {
    if (!draggedStaffId || draggedStaffId === targetId) return
    const newOrder = [...staff]
    const fromIdx = newOrder.findIndex(s => s.id === draggedStaffId)
    const toIdx = newOrder.findIndex(s => s.id === targetId)
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    setStaff(newOrder.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })))
    setDraggedStaffId(null)
  }, [draggedStaffId, staff])

  const handleSaveOrder = useCallback(async () => {
    setSavingOrder(true)
    await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_staff', order: staff.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 })) }),
    })
    setSavingOrder(false); setReorderMode(false)
  }, [staff])

  const prevMonth = useCallback(() => {
    const d = new Date(year, month - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }, [year, month])

  const nextMonth = useCallback(() => {
    const d = new Date(year, month, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }, [year, month])

  return {
    // data
    staff, shifts, holidays, settings, loading, saving,
    year, month, days, monthLabel, today, userRole, userName, employeeId,
    staffSummary, missingByDate,
    // edit shift modal
    editCell, setEditCell,
    editMode, setEditMode,
    editPreset,
    editStart, setEditStart,
    editEnd, setEditEnd,
    editLeaveType, setEditLeaveType,
    wholeWeek, setWholeWeek,
    bulkSaving,
    // staff modal
    showAddStaff, setShowAddStaff,
    editStaff, setEditStaff,
    savingStaff,
    // settings modal
    showSettings, setShowSettings,
    settingsForm, setSettingsForm,
    savingSettings,
    // copy / delete
    copying, copyResult,
    showDeleteMonth, setShowDeleteMonth,
    deletingMonth,
    // reorder
    reorderMode, setReorderMode,
    draggedStaffId, setDraggedStaffId,
    savingOrder,
    // handlers
    getShift, getHoliday,
    handleCellClick, handlePresetSelect,
    handleSaveShift, handleDeleteShift, handleDeleteMonth,
    handleAddStaff, handleSaveStaff, handleToggleStaffActive,
    handleCopyMonth, handleSaveSettings,
    handleReorderDrop, handleSaveOrder,
    prevMonth, nextMonth,
  }
}
