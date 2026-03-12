// app/(dashboard)/hall/types.ts

export interface HallClass {
  id: string
  name: string
  price_cash: number
  price_subscription: number
  price_multisport: number
  price_coolfit: number
  instructor_percent: number
  max_capacity: number
  duration_minutes: number
}

export interface HallAttendance {
  id: string
  class_id: string
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
  visits_unknown: number
  total_visits: number
  total_revenue: number
  instructor_percent: number
  adjustments: number
  final_payment: number
  hall_classes?: { name: string }
}

export interface Reconciliation {
  class_name: string
  operator: string
  visits_gymrealm: number
  visits_operator: number
  difference: number
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
  is_locked: boolean
}

export interface ClientVisit {
  client_name: string
  class_name: string
  total_visits: number
  months_active: number
  first_seen?: string
  last_seen?: string
}

export interface NoShowClient {
  client_name: string
  class_name: string
  client_phone?: string
  total_noshows: number
  noshow_percent: number
  last_noshow?: string
}

export interface LapsedClient {
  client_name: string
  last_seen?: string
  classes: string
  total_visits: number
}

export type TabKey = 'attendance' | 'yearly' | 'reconciliation' | 'clients' | 'import' | 'config'

export const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']

export function monthLabel(dateStr?: string): string {
  const d = new Date(dateStr || new Date().toISOString())
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function pctChange(current: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((current - prev) / prev) * 100)
}
