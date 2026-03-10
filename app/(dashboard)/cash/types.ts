// app/(dashboard)/cash/types.ts

export interface CashRecord {
  id: string
  date: string
  staff_name: string
  gym_cash_system: number | null
  gym_cash_counted: number | null
  notes: string | null
  admin_cash_counted: number | null
  admin_counted_by: string | null
  admin_counted_at: string | null
  gymrealm_gym_cash: number | null
  gymrealm_uploaded_at: string | null
  alert_physical_diff: boolean
  alert_system_diff: boolean
  alert_seen_by_staff: boolean
  created_at: string
}
