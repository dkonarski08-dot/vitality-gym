import { useState } from 'react'

interface MonthNavState {
  viewYear: number
  viewMonth: number
  monthStart: string
  monthEnd: string
  isCurrentMonth: boolean
  goToPrevMonth: () => void
  goToNextMonth: () => void
  resetToMonth: (year: number, month: number) => void
}

export function useMonthNav(onMonthChange?: (year: number, month: number) => void): MonthNavState {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()) // 0-indexed

  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const isCurrentMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth()

  const goToPrevMonth = () => {
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1
    const newYear = viewMonth === 0 ? viewYear - 1 : viewYear
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  const goToNextMonth = () => {
    const now = new Date()
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1
    const newYear = viewMonth === 11 ? viewYear + 1 : viewYear
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  const resetToMonth = (year: number, month: number) => {
    setViewYear(year)
    setViewMonth(month)
    onMonthChange?.(year, month)
  }

  return { viewYear, viewMonth, monthStart, monthEnd, isCurrentMonth, goToPrevMonth, goToNextMonth, resetToMonth }
}
