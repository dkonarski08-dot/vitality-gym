// app/(dashboard)/cash/hooks/useCash.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
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
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const headers = rows.length > 0 ? Object.keys(rows[0]) : []

      const dateKey = headers.find(h => {
        const l = h.toLowerCase()
        return l.includes('дата') || l.includes('date') || l.includes('ден')
      })
      const cashKey = headers.find(h => {
        const l = h.toLowerCase()
        return l.includes('в брой') || l === 'cash' || l.includes('брой')
      })

      type DayEntry = { date: string; gymrealm_gym_cash: number | null }
      const entries: DayEntry[] = []

      if (dateKey && cashKey) {
        for (const row of rows) {
          const rawDate = row[dateKey]
          const rawCash = row[cashKey]

          let parsedDate: string | null = null
          if (rawDate instanceof Date) {
            parsedDate = rawDate.toISOString().split('T')[0]
          } else {
            const s = String(rawDate).trim()
            const dmyMatch = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
            const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
            else if (ymdMatch) parsedDate = s
            else if (/^\d{5}$/.test(s)) {
              const d = new Date((parseInt(s) - 25569) * 86400000)
              parsedDate = d.toISOString().split('T')[0]
            }
          }
          if (!parsedDate) continue

          const cashNum = parseFloat(String(rawCash).replace(',', '.').replace(/\s/g, ''))
          entries.push({ date: parsedDate, gymrealm_gym_cash: isNaN(cashNum) || cashNum <= 0 ? null : cashNum })
        }
      } else {
        for (const row of rows) {
          let parsedDate: string | null = null
          let cashAmount: number | null = null
          for (const [key, val] of Object.entries(row)) {
            const s = String(val).trim()
            if (!parsedDate) {
              const dmyMatch = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
              const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
              if (dmyMatch) parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
              else if (ymdMatch) parsedDate = s
            }
            const kl = key.toLowerCase()
            if (!cashAmount && (kl.includes('брой') || kl.includes('cash'))) {
              const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
              if (!isNaN(n) && n > 0) cashAmount = n
            }
          }
          if (parsedDate) entries.push({ date: parsedDate, gymrealm_gym_cash: cashAmount })
        }
      }

      if (entries.length === 0) {
        setImportResult(`⚠️ Обработен (${rows.length} реда), но не бяха намерени дати. Провери формата.`)
        setImporting(false); return
      }

      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gymrealm_import', entries, filename: importFile.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setImportResult(`✅ Записани ${entries.length} дня (${rows.length} реда в файла)`)
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
