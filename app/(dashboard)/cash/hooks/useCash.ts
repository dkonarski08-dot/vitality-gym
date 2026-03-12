// app/(dashboard)/cash/hooks/useCash.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useMonthNav } from '@/hooks/useMonthNav'
import { CashRecord } from '../types'

export function useCash() {
  const { userRole, userName } = useSession()
  const [records, setRecords] = useState<CashRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Receptionist fields
  const [gymSystem, setGymSystem] = useState('')
  const [gymCounted, setGymCounted] = useState('')
  const [notes, setNotes] = useState('')

  // Admin fields
  const [adminDate, setAdminDate] = useState(() => new Date().toISOString().split('T')[0])
  const [adminCounted, setAdminCounted] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminSaved, setAdminSaved] = useState(false)

  // GymRealm import
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  const { viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth, goToPrevMonth, goToNextMonth, resetToMonth } = useMonthNav(
    (newYear, newMonth) => {
      const now = new Date()
      const isNowCurrent = newYear === now.getFullYear() && newMonth === now.getMonth()
      const newLastDay = new Date(newYear, newMonth + 1, 0).getDate()
      const newMonthEnd = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(newLastDay).padStart(2, '0')}`
      setAdminDate(isNowCurrent ? now.toISOString().split('T')[0] : newMonthEnd)
      setAdminCounted('')
      setAdminSaved(false)
    }
  )

  const loadData = useCallback(async (dateForAdmin?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cash?role=${userRole}&from=${monthStart}&to=${monthEnd}`)
      const data = await res.json()
      const recs: CashRecord[] = data.records || []
      setRecords(recs)

      const nowMonth = new Date().getMonth()
      const nowYear = new Date().getFullYear()
      if (viewMonth === nowMonth && viewYear === nowYear) {
        const todayRec = recs.find(r => r.date === today)
        if (todayRec && todayRec.staff_name !== '—') {
          setGymSystem(todayRec.gym_cash_system != null ? String(todayRec.gym_cash_system) : '')
          setGymCounted(todayRec.gym_cash_counted != null ? String(todayRec.gym_cash_counted) : '')
          setNotes(todayRec.notes || '')
          setSaved(true)
        }
      }

      if (userRole === 'admin' && dateForAdmin) {
        const dateRec = recs.find(r => r.date === dateForAdmin)
        setAdminCounted(dateRec?.admin_cash_counted != null ? String(dateRec.admin_cash_counted) : '')
        setAdminSaved(dateRec?.admin_cash_counted != null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане')
    }
    setLoading(false)
  }, [userRole, today, monthStart, monthEnd, viewMonth, viewYear])

  useEffect(() => { loadData(adminDate) }, [loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdminDateChange = (newDate: string) => {
    setAdminDate(newDate)
    setAdminSaved(false)
    const rec = records.find(r => r.date === newDate)
    setAdminCounted(rec?.admin_cash_counted != null ? String(rec.admin_cash_counted) : '')
    setAdminSaved(rec?.admin_cash_counted != null)
  }

  const handleStaffSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'staff_save',
          staff_name: userName,
          date: today,
          gym_cash_system: gymSystem,
          gym_cash_counted: gymCounted,
          hall_cash_system: null,
          hall_cash_counted: null,
          deposit: null,
          notes,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSaved(true)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
    setSaving(false)
  }

  const handleAdminSave = async () => {
    setAdminSaving(true)
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_count',
          date: adminDate,
          admin_cash_counted: adminCounted,
          admin_counted_by: userName,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setAdminSaved(true)
      await loadData(adminDate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
    setAdminSaving(false)
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    try {
      const arrayBuffer = await importFile.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const fileBase64 = btoa(binary)

      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gymrealm_import', fileBase64, filename: importFile.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setImportResult(`✅ Записани ${data.daysImported} дня`)
      setImportFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadData(adminDate)
    } catch (err) {
      setImportResult(`❌ ${err instanceof Error ? err.message : 'Грешка'}`)
    }
    setImporting(false)
  }

  const handleAckAlert = async (date: string) => {
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack_alert', date }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Грешка') }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    }
  }

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdayRec = records.find(r => r.date === yesterdayStr)
  const hasYesterdayAlert = !!(yesterdayRec &&
    (yesterdayRec.alert_physical_diff || yesterdayRec.alert_system_diff) &&
    !yesterdayRec.alert_seen_by_staff)

  const alertRecords = records.filter(r => r.alert_physical_diff || r.alert_system_diff)
  const recordsWithData = records.filter(r => r.gym_cash_counted != null)

  const adminRec = records.find(r => r.date === adminDate)
  const grDiff = adminRec?.gymrealm_gym_cash != null && adminRec?.gym_cash_counted != null
    ? adminRec.gym_cash_counted - adminRec.gymrealm_gym_cash : null

  return {
    userRole, loading, error, setError,
    // receptionist
    records, saving, saved, setSaved,
    gymSystem, setGymSystem, gymCounted, setGymCounted, notes, setNotes,
    // admin
    adminDate, adminCounted, setAdminCounted, adminSaving, adminSaved,
    // import
    importFile, setImportFile, importing, importResult, setImportResult, dragOver, setDragOver, fileInputRef,
    // month nav
    viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth,
    goToPrevMonth, goToNextMonth, resetToMonth,
    // derived
    today, yesterdayStr, yesterdayRec, hasYesterdayAlert,
    alertRecords, recordsWithData, adminRec, grDiff,
    // handlers
    handleStaffSave, handleAdminSave, handleImport, handleAckAlert, handleAdminDateChange,
  }
}
