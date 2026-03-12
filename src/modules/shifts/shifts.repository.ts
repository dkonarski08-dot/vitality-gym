// src/modules/shifts/shifts.repository.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Shift, StaffMember } from '@/src/types/database'

export async function getStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function getShiftsForMonth(yearMonth: string): Promise<Shift[]> {
  // yearMonth format: "2026-03"
  const startDate = `${yearMonth}-01`
  const endDate = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0)
  const endStr = `${yearMonth}-${String(endDate.getDate()).padStart(2, '0')}`

  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('*, staff:employees(id, name, role)')
    .gte('date', startDate)
    .lte('date', endStr)
    .order('date')
  if (error) throw error
  return data || []
}

export async function upsertShift(shift: {
  staff_id: string
  date: string
  start_time: string
  end_time: string
  shift_type: string
  notes?: string
}): Promise<Shift> {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .upsert({
      ...shift,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_id,date' })
    .select('*, staff:employees(id, name, role)')
    .single()
  if (error) throw error
  return data
}

export async function deleteShift(staffId: string, date: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('shifts')
    .delete()
    .eq('staff_id', staffId)
    .eq('date', date)
  if (error) throw error
}

export async function getMonthlyHoursSummary(yearMonth: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_monthly_hours')
    .select('*')
    .eq('month', `${yearMonth}-01`)
  if (error) throw error
  return data || []
}
