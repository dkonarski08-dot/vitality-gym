// src/types/database.ts
// Core types matching Supabase schema

export type UserRole = 'admin' | 'receptionist' | 'instructor'

export interface StaffMember {
  id: string
  name: string
  role: UserRole
  email: string | null
  phone: string | null
  hourly_rate: number
  food_voucher: number
  max_hours_per_month: number
  hire_date: string | null
  date_of_birth: string | null
  active: boolean
  pin_code: string | null
  notes: string | null
  created_at: string
}

export interface Shift {
  id: string
  staff_id: string
  date: string
  start_time: string
  end_time: string
  shift_type: 'morning' | 'afternoon' | 'full' | 'custom'
  actual_start: string | null
  actual_end: string | null
  notes: string | null
  created_at: string
  staff?: StaffMember
}

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
  active: boolean
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
  status: string
}

export interface YearlyRow {
  month: string
  total_visits: number
  visits_cash: number
  visits_subscription: number
  visits_multisport: number
  visits_coolfit: number
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

// Navigation
export interface NavItem {
  key: string
  label: string
  icon: string
  href: string
  roles: UserRole[]
  badge?: number
}

// Login account — separate from StaffMember (HR/payroll)
// pin_hash is intentionally excluded — never sent to client
// API routes select columns explicitly to enforce this
export interface AppUser {
  id: string
  gym_id: string
  name: string
  role: 'admin' | 'receptionist' | 'instructor'
  employee_id: string | null
  phone: string | null
  birth_date: string | null   // ISO date: YYYY-MM-DD
  hired_at: string | null     // ISO date: YYYY-MM-DD
  is_active: boolean
  created_at: string
  updated_at: string
}
