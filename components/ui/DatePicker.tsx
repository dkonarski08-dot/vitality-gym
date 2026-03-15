// components/ui/DatePicker.tsx
// Custom dropdown calendar — no native picker dependency
'use client'

import { useState, useRef, useEffect } from 'react'
import { MONTHS_BG, DAYS_BG_SHORT } from '@/lib/formatters'

interface DatePickerProps {
  value: string           // YYYY-MM-DD
  onChange: (v: string) => void
  label?: string
  min?: string            // YYYY-MM-DD — days before this are disabled
  max?: string            // YYYY-MM-DD — days after this are disabled
  className?: string
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function prettyDate(v: string) {
  if (!v) return 'Избери дата'
  const d = new Date(v + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_BG[d.getMonth()]} ${d.getFullYear()}`
}

export default function DatePicker({ value, onChange, label, min, max, className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false)

  // Calendar view state
  const seed = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(seed.getFullYear())
  const [viewMonth, setViewMonth] = useState(seed.getMonth())

  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const minDate = min ? new Date(min + 'T12:00:00') : null
  const maxDate = max ? new Date(max + 'T12:00:00') : null

  // Build calendar grid — always starts Monday
  const firstDay = new Date(viewYear, viewMonth, 1)
  // getDay() returns 0=Sun; we want Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const handleDayClick = (day: number) => {
    const chosen = new Date(viewYear, viewMonth, day)
    if (maxDate && chosen > maxDate) return
    onChange(toYMD(chosen))
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const today = toYMD(new Date())

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="text-xs text-white/70 block mb-1.5">{label}</label>}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white hover:border-white/30 hover:bg-white/[0.07] transition-colors text-left"
      >
        <span className="text-white/50 text-base">📅</span>
        <span className={value ? 'text-white' : 'text-white/40'}>{prettyDate(value)}</span>
        <span className="ml-auto text-white/30 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-[#13131a] border border-white/15 rounded-2xl shadow-2xl p-3 select-none">
          {/* Month/year header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors">‹</button>
            <span className="text-sm font-semibold text-white">
              {MONTHS_BG[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors">›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_BG_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] text-white/30 font-medium py-0.5">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const cellDate = toYMD(new Date(viewYear, viewMonth, day))
              const isSelected = cellDate === value
              const isToday = cellDate === today
              const cellDateObj = new Date(viewYear, viewMonth, day)
              const isDisabled = (maxDate != null && cellDateObj > maxDate) || (minDate != null && cellDateObj < minDate)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDayClick(day)}
                  className={`
                    w-full aspect-square flex items-center justify-center rounded-lg text-sm transition-colors
                    ${isSelected ? 'bg-amber-500 text-black font-bold' : ''}
                    ${isToday && !isSelected ? 'border border-amber-500/40 text-amber-400' : ''}
                    ${!isSelected && !isToday && !isDisabled ? 'text-white/80 hover:bg-white/10' : ''}
                    ${isDisabled ? 'text-white/20 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          {(!max || today <= max) && (!min || today >= min) && (
            <button
              type="button"
              onClick={() => { onChange(today); setOpen(false) }}
              className="w-full mt-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
            >
              Днес
            </button>
          )}
        </div>
      )}
    </div>
  )
}
