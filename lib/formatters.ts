export const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

// Sunday-first, full names — used by formatDate (JS getDay() returns 0=Sunday)
export const DAYS_BG = ['Неделя','Понеделник','Вторник','Сряда','Четвъртък','Петък','Събота']

// Monday-first, abbreviated — used in shifts calendar grid (dowIdx = getDay()==0 ? 6 : getDay()-1)
export const DAYS_BG_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAYS_BG[d.getDay()]}, ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}
