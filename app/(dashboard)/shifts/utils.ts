// app/(dashboard)/shifts/utils.ts

export interface Staff {
  id: string
  name: string
  role: string
  hourly_rate: number
  phone: string | null
  active: boolean
  sort_order: number
}

export interface Shift {
  id: string
  staff_id: string
  date: string
  start_time: string
  end_time: string
  shift_type: string
  notes: string | null
}

export interface Holiday { date: string; name: string }

export interface GymSettings {
  weekday_open: string
  weekday_close: string
  weekday_shift_duration_minutes: number
  saturday_open: string
  saturday_close: string
  saturday_shifts: number
  sunday_open: string
  sunday_close: string
  sunday_shifts: number
}

export const LEAVE_TYPES = [
  { label: 'Болничен', type: 'sick', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  { label: 'Платен отпуск', type: 'paid_leave', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { label: 'Неплатен отпуск', type: 'unpaid_leave', color: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
]

export const STAFF_ROLES = [
  { value: 'Reception', label: 'Рецепция' },
  { value: 'instructor', label: 'Инструктор' },
  { value: 'cleaning', label: 'Почистване' },
  { value: 'admin', label: 'Администратор' },
]

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}

export function getShiftTimes(
  settings: GymSettings,
  dayOfWeek: number,
  type: 'first' | 'second' | 'full'
): { start: string; end: string } {
  let open: string, close: string, duration: number, shifts: number
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    open = settings.weekday_open.slice(0, 5)
    close = settings.weekday_close.slice(0, 5)
    duration = settings.weekday_shift_duration_minutes
    shifts = 2
  } else if (dayOfWeek === 6) {
    open = settings.saturday_open.slice(0, 5)
    close = settings.saturday_close.slice(0, 5)
    duration = Math.round(calcHours(settings.saturday_open.slice(0, 5), settings.saturday_close.slice(0, 5)) * 60 / (settings.saturday_shifts || 1))
    shifts = settings.saturday_shifts
  } else {
    open = settings.sunday_open.slice(0, 5)
    close = settings.sunday_close.slice(0, 5)
    duration = Math.round(calcHours(settings.sunday_open.slice(0, 5), settings.sunday_close.slice(0, 5)) * 60 / (settings.sunday_shifts || 1))
    shifts = settings.sunday_shifts
  }
  if (type === 'full' || shifts === 1) return { start: open, end: close }
  if (type === 'first') return { start: open, end: addMinutes(open, duration) }
  return { start: addMinutes(open, duration), end: close }
}

export function getShiftDisplay(shift: Shift): { text: string; sub?: string; color: string } {
  const leave = LEAVE_TYPES.find(l => l.type === shift.shift_type)
  if (leave) return { text: leave.label, color: leave.color }
  const hours = calcHours(shift.start_time, shift.end_time)
  const label = shift.shift_type === 'first' ? 'I' : shift.shift_type === 'second' ? 'II' : ''
  return {
    text: `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`,
    sub: `${hours.toFixed(0)}ч${label ? ' ' + label : ''}`,
    color: shift.shift_type === 'first'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
      : shift.shift_type === 'second'
        ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) days.push(new Date(year, month, d))
  return days
}

export function roleGradient(role: string): string {
  if (role === 'admin') return 'from-amber-400 to-orange-500'
  if (role === 'instructor') return 'from-emerald-400 to-green-500'
  if (role === 'cleaning') return 'from-purple-400 to-violet-500'
  return 'from-sky-400 to-blue-500'
}
