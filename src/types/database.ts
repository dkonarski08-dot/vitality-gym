// src/types/database.ts
// Core types matching Supabase schema

export type UserRole = 'admin' | 'receptionist' | 'instructor' | 'cleaning'

export interface SessionState {
  role: UserRole
  name: string
  employeeId: string | null
}

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
  role: UserRole
  employee_id: string | null
  phone: string | null
  birth_date: string | null   // ISO date: YYYY-MM-DD
  hired_at: string | null     // ISO date: YYYY-MM-DD
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── PT Module Types ───────────────────────────────────────────────────────

// Single source of truth — DB CHECK constraint mirrors this array
export const PT_SESSION_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
export type PTSessionStatus = typeof PT_SESSION_STATUSES[number]

export interface PTSession {
  id: string
  gym_id: string
  membership_id: string
  client_id: string
  instructor_id: string
  scheduled_at: string
  duration_minutes: number
  status: PTSessionStatus
  notes: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export interface PTSessionWithDetails extends PTSession {
  client_name: string
  client_phone: string | null
  instructor_name: string
  membership_name: string
  sessions_remaining: number
  sessions_total: number
}

// PT client with active PT membership — for read-only client list in PT schedule
export interface PTActiveClient {
  id: string
  name: string
  phone: string | null
  membership_id: string
  membership_name: string
  sessions_total: number
  sessions_used: number
  instructor_id: string
  instructor_name: string
  expires_at: string | null
}

// ─── Sales & Inventory Types ───────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card'

export interface Sale {
  id: string
  gym_id: string
  sale_date: string
  sale_time: string
  total_amount: number
  payment_method: PaymentMethod
  member_id: string | null
  staff_name: string
  notes: string | null
  voided: boolean
  voided_by: string | null
  voided_at: string | null
  created_at: string
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string | null
  product_name: string
  category: string | null
  quantity: number
  unit: string | null
  unit_price: number
  total_price: number
}

export interface InventoryProduct {
  product_id: string
  gym_id: string
  product_name: string
  category: string | null
  unit: string | null
  selling_price: number | null
  barcode: string | null
  min_stock: number
  active_for_sale: boolean
  current_stock: number
  low_stock: boolean
}

export type AdjustmentReason = 'damage' | 'theft' | 'count' | 'return' | 'other'

export interface InventoryAdjustment {
  id: string
  gym_id: string
  product_id: string | null
  product_name: string
  quantity_delta: number
  reason: AdjustmentReason
  staff_name: string
  notes: string | null
  created_at: string
}

// Delivery product with selling fields (extended)
export interface DeliveryProduct {
  id: string
  gym_id: string
  name: string
  category: string | null
  unit: string | null
  last_price: number | null
  order_count: number
  selling_price: number | null
  barcode: string | null
  min_stock: number
  active_for_sale: boolean
}

export interface PTInquiry {
  id: string
  gym_id: string
  name: string
  phone: string
  preferred_days: string[] | null
  preferred_time_slot: string | null
  goal: string | null
  notes: string | null
  source: string | null
  status: 'pending' | 'done'
  outcome: 'won' | 'lost' | null
  lost_reason: string | null
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  // Optional joined relation
  assigned?: { id: string; name: string } | null
}

// ─── Clients & Services Module ────────────────────────────────────────────────

export type DiscountTier = 'none' | 'standard' | 'vip'

export interface Client {
  id: string
  gym_id: string
  name: string
  phone: string
  discount_tier: DiscountTier
  notes: string | null
  created_at: string
}

export type BusinessUnit = 'gym' | 'hall'
export type IntegrationType = 'membership' | 'pt_package' | 'pt_single' | 'service_record' | 'hall_entry'

export interface ServiceType {
  id: string
  gym_id: string
  name: string
  price: number
  category: string
  business_unit: BusinessUnit
  integration_type: IntegrationType
  duration_days: number | null
  active: boolean
  created_at: string
}

export interface ServiceRecord {
  id: string
  gym_id: string
  client_id: string
  service_type_id: string | null
  sale_id: string | null
  starts_at: string | null
  ends_at: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface OpenTabItem {
  type: 'product' | 'service'
  id: string
  name: string
  unit_price: number
  quantity: number
  total_price: number
  category: string
  integration_type?: IntegrationType
  starts_at?: string
}

export interface OpenTab {
  id: string
  gym_id: string
  business_unit: BusinessUnit
  client_id: string | null
  has_services: boolean
  items: OpenTabItem[]
  total_amount: number
  discount_amount: number
  created_by: string
  created_at: string
  client?: Client
}

export interface ClientMembership {
  id: string
  gym_id: string
  client_id: string
  service_type_id: string | null
  status: 'active' | 'expired' | 'cancelled'
  started_at: string
  ends_at: string | null
  notes: string | null
  created_at: string
  service_type?: ServiceType
}
