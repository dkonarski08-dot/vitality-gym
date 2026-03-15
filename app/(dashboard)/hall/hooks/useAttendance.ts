// app/(dashboard)/hall/hooks/useAttendance.ts
// Handles edit state and server mutations for individual hall_attendance rows.
// All DB writes go through API routes — never direct supabase from client.
import { useState } from 'react'
import { HallAttendance, Reconciliation } from './useHallData'

export function useAttendance(
  attendance: HallAttendance[],
  reconciliation: Reconciliation[],
  selectedMonth: string,
  loadData: () => Promise<void>
) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<HallAttendance>>({})
  const [recalculating, setRecalculating] = useState(false)
  const [applyingRecon, setApplyingRecon] = useState(false)
  const [restoringOriginal, setRestoringOriginal] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Save individual row edit via API (not direct supabase)
  const saveEdit = async (id: string) => {
    setSaveError(null)
    const row = attendance.find(a => a.id === id)
    if (!row) return
    const updated = { ...row, ...editValues }

    try {
      const res = await fetch('/api/hall/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_row',
          id,
          visits_cash:          updated.visits_cash,
          visits_subscription:  updated.visits_subscription,
          visits_multisport:    updated.visits_multisport,
          visits_coolfit:       updated.visits_coolfit,
          instructor_percent:   updated.instructor_percent,
          adjustments:          updated.adjustments ?? 0,
          adjustment_notes:     updated.adjustment_notes ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при записване')

      setEditingId(null)
      setEditValues({})
      await loadData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при записване')
    }
  }

  const handleRecalculate = async () => {
    setSaveError(null)
    setRecalculating(true)
    try {
      const res = await fetch('/api/hall/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при преизчисляване')
      await loadData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при преизчисляване')
    } finally {
      setRecalculating(false)
    }
  }

  // Apply reconciliation — batch parallel updates via supabase (still client-side but read-only risk is low)
  // TODO: move to API if security becomes a concern
  const handleApplyReconciliation = async () => {
    setSaveError(null)
    setApplyingRecon(true)
    try {
      const res = await fetch('/api/hall/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_reconciliation',
          month: selectedMonth,
          reconciliation: reconciliation.map(row => {
            const attRow = attendance.find(a => a.hall_classes?.name === row.class_name)
            return attRow ? {
              attendance_id: attRow.id,
              operator: row.operator,
              visits_operator: row.visits_operator,
            } : null
          }).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при прилагане на reconciliation')
      await loadData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при прилагане на reconciliation')
    } finally {
      setApplyingRecon(false)
    }
  }

  const handleRestoreOriginal = async () => {
    setSaveError(null)
    setRestoringOriginal(true)
    try {
      const res = await fetch('/api/hall/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_original',
          month: selectedMonth,
          reconciliation: reconciliation.map(row => {
            const attRow = attendance.find(a => a.hall_classes?.name === row.class_name)
            return attRow ? {
              attendance_id: attRow.id,
              operator: row.operator,
              visits_gymrealm: row.visits_gymrealm,
            } : null
          }).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при възстановяване')
      await loadData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при възстановяване на данните')
    } finally {
      setRestoringOriginal(false)
    }
  }

  return {
    editingId, setEditingId,
    editValues, setEditValues,
    recalculating, applyingRecon, restoringOriginal,
    saveError, setSaveError,
    saveEdit, handleRecalculate,
    handleApplyReconciliation, handleRestoreOriginal,
  }
}
