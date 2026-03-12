import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase' // read-only queries only

export interface HallClass {
  id: string
  name: string
  instructor_percent: number
  price_cash: number
  price_subscription: number
  price_multisport: number
  price_coolfit: number
  max_capacity: number
  duration_minutes: number
}

export interface HallAttendance {
  id: string
  class_id: string
  month: string
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  visits_unknown: number
  total_visits: number
  revenue_cash: number
  revenue_subscription: number
  revenue_multisport: number
  revenue_coolfit: number
  total_revenue: number
  instructor_percent: number
  instructor_fee: number
  adjustments: number
  adjustment_notes: string
  final_payment: number
  hall_classes?: HallClass
}

export interface Reconciliation {
  id: string
  month: string
  operator: string
  class_name: string
  visits_gymrealm: number
  visits_operator: number
  difference: number
  rate_eur: number
  total_eur: number
  total_bgn: number
  status: string
}

export interface YearlyRow {
  month: string
  total_visits: number
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  revenue_multisport: number
  revenue_coolfit: number
  total_revenue: number
  total_payments: number
  gym_profit: number
  margin_percent: number
  is_locked: boolean
}

export interface ClientVisit {
  client_name: string
  class_name: string
  months_active: number
  total_visits: number
  first_seen: string
  last_seen: string
}

export interface NoShowClient {
  client_name: string
  client_phone: string | null
  class_name: string
  total_noshows: number
  total_visits: number
  noshow_percent: number
  last_noshow: string
}

export interface LapsedClient {
  client_name: string
  last_seen: string
  total_visits: number
  classes: string
}

function getPrevMonth(month: string): string {
  const d = new Date(month)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function useHallData(selectedMonth: string) {
  const [attendance, setAttendance] = useState<HallAttendance[]>([])
  const [prevAttendance, setPrevAttendance] = useState<HallAttendance[]>([])
  const [classes, setClasses] = useState<HallClass[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation[]>([])
  const [yearlyData, setYearlyData] = useState<YearlyRow[]>([])
  const [allClients, setAllClients] = useState<ClientVisit[]>([])
  const [noshows, setNoshows] = useState<NoShowClient[]>([])
  const [lapsedClients, setLapsedClients] = useState<LapsedClient[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const prevMonthStr = getPrevMonth(selectedMonth)

    try {
      const [
        { data: att, error: attErr },
        { data: prevAtt },
        { data: cls },
        { data: recon },
        { data: yearly },
        { data: cv },
        { data: ns },
        { data: lapsed },
        { data: ms },
      ] = await Promise.all([
        supabase.from('hall_attendance').select('*, hall_classes(*)').eq('month', selectedMonth).order('hall_classes(name)'),
        supabase.from('hall_attendance').select('*, hall_classes(*)').eq('month', prevMonthStr),
        supabase.from('hall_classes').select('*').eq('active', true).order('name'),
        supabase.from('hall_reconciliation').select('*').eq('month', selectedMonth).order('class_name'),
        supabase.from('hall_yearly_overview').select('*').order('month', { ascending: false }),
        supabase.from('hall_client_summary').select('*').order('total_visits', { ascending: false }),
        supabase.from('hall_noshow_summary').select('*').order('total_noshows', { ascending: false }),
        supabase.from('hall_lapsed_clients').select('*').order('last_seen', { ascending: false }),
        supabase.from('hall_month_status').select('is_locked').eq('month', selectedMonth).maybeSingle(),
      ])

      if (attErr) throw attErr

      setAttendance(att || [])
      setPrevAttendance(prevAtt || [])
      setClasses(cls || [])
      setReconciliation(recon || [])
      setYearlyData(yearly || [])
      setAllClients(cv || [])
      setNoshows(ns || [])
      setLapsedClients(lapsed || [])
      setIsLocked(ms?.is_locked || false)

      const allMonths = [...new Set((yearly || []).map((r: YearlyRow) => r.month?.substring(0, 7)))].sort() as string[]
      setAvailableMonths(allMonths)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане на данните')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  // Toggle month lock via API to keep mutations server-side
  const toggleLock = async () => {
    const newLocked = !isLocked
    try {
      const res = await fetch('/api/hall/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_lock', month: selectedMonth, is_locked: newLocked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при заключване')
      setIsLocked(newLocked)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при промяна на заключването')
    }
  }

  return {
    attendance, prevAttendance, classes, reconciliation,
    yearlyData, allClients, noshows, lapsedClients,
    availableMonths, isLocked, loading, error,
    loadData, toggleLock, setIsLocked,
  }
}
