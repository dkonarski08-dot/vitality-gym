// app/(dashboard)/pt/components/PTInquiryList.tsx
'use client'

import { useState } from 'react'
import { Instructor } from '../page'

export interface PTInquiry {
  id: string
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
  assigned_to: string | null
  assigned: { id: string; name: string } | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface Props {
  inquiries: PTInquiry[]
  instructors: Instructor[]
  userRole: string
  onRefresh: () => void
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '🌅 Сутрин',
  afternoon: '☀️ Обяд',
  evening: '🌙 Вечер',
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Нд',
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: '⚖️ Отслабване',
  muscle: '💪 Мускулна маса',
  cardio: '🏃 Кардио',
  rehab: '🩺 Рехабилитация',
  general: '✨ Обща форма',
}

function getTimeSlotChips(slot: string | null): string[] {
  if (!slot) return []
  return slot.split(',').map(s => s.trim()).filter(Boolean)
}

function getDaysOrAll(days: string[] | null): { isAll: boolean; days: string[] } {
  if (!days || days.length === 0) return { isAll: false, days: [] }
  if (days.length >= 7) return { isAll: true, days: [] }
  return { isAll: false, days }
}

function getAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
}

async function postInquiryAction(payload: Record<string, unknown>): Promise<void> {
  await fetch('/api/pt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export default function PTInquiryList({ inquiries, instructors, onRefresh }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  const filtered = filter === 'all' ? inquiries : inquiries.filter(i => i.status === filter)

  const pendingCount = inquiries.filter(i => i.status === 'pending').length
  const wonCount = inquiries.filter(i => i.outcome === 'won').length
  const lostCount = inquiries.filter(i => i.outcome === 'lost').length
  const totalDone = wonCount + lostCount
  const conversionPct = totalDone > 0 ? Math.round((wonCount / totalDone) * 100) : 0

  async function handleOutcome(id: string, outcome: 'won' | 'lost') {
    await postInquiryAction({ action: 'update_inquiry', inquiry_id: id, status: 'done', outcome })
    onRefresh()
  }

  async function handleReopen(id: string) {
    await postInquiryAction({ action: 'update_inquiry', inquiry_id: id, status: 'pending', outcome: null })
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Изтриване на запитването?')) return
    await postInquiryAction({ action: 'delete_inquiry', inquiry_id: id })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Stats pills */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
          <span className="font-semibold text-amber-400">{pendingCount}</span>
          <span className="text-white/60">активни</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
          <span className="font-semibold text-emerald-400">{wonCount}</span>
          <span className="text-white/60">спечелени</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
          <span className="font-semibold text-red-400">{lostCount}</span>
          <span className="text-white/60">загубени</span>
        </span>
        {totalDone > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
            <span className="font-semibold text-white">{conversionPct}%</span>
            <span className="text-white/60">конверсия</span>
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 w-fit bg-white/[0.03] border border-white/[0.07] rounded-lg">
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f ? 'bg-amber-400/15 text-amber-400' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {f === 'all' ? 'Всички' : f === 'pending' ? 'За обработка' : 'Приключени'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-white/[0.04]">
            <tr>
              {['Клиент', 'Дни', 'Час', 'Цел', 'Инструктор', 'Статус', 'Действия'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">
                  Няма запитвания
                </td>
              </tr>
            )}
            {filtered.map(inq => {
              const isDone = inq.status === 'done'
              const ageDays = getAgeDays(inq.created_at)
              const timeChips = getTimeSlotChips(inq.preferred_time_slot)
              const { isAll, days } = getDaysOrAll(inq.preferred_days)
              const allSlots = timeChips.length >= 3
              const instructor = instructors.find(i => i.id === inq.assigned_to)
              const initials = instructor ? instructor.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : null

              return (
                <tr key={inq.id} className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors ${isDone ? 'opacity-50' : ''}`}>
                  {/* Client */}
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-white text-sm">{inq.name}</div>
                    <div className="text-xs text-white/40 mt-0.5">{inq.phone}</div>
                    {inq.notes && <div className="text-[11px] text-white/30 italic mt-1 max-w-[180px] truncate">{inq.notes}</div>}
                  </td>
                  {/* Days */}
                  <td className="px-4 py-3 align-top">
                    {isAll ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-white/[0.06] border border-white/[0.12] text-white/45">Всеки ден</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {days.map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded text-[11px] bg-amber-400/10 border border-amber-400/25 text-amber-400 font-medium">{DAY_LABELS[d] ?? d}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* Time */}
                  <td className="px-4 py-3 align-top">
                    {allSlots ? (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-white/[0.05] border border-white/[0.12] text-white/45">🕐 Гъвкав</span>
                    ) : timeChips.length === 0 ? (
                      <span className="text-white/25 text-xs">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {timeChips.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded text-[11px] bg-sky-400/10 border border-sky-400/20 text-sky-400 font-medium whitespace-nowrap">
                            {TIME_SLOT_LABELS[t] ?? t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* Goal */}
                  <td className="px-4 py-3 align-top">
                    {inq.goal ? (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-violet-400/10 border border-violet-400/20 text-violet-400">
                        {GOAL_LABELS[inq.goal] ?? inq.goal}
                      </span>
                    ) : <span className="text-white/25 text-xs">—</span>}
                  </td>
                  {/* Instructor */}
                  <td className="px-4 py-3 align-top">
                    {instructor ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                          {initials}
                        </div>
                        <span className="text-xs text-white/75">{instructor.name}</span>
                      </div>
                    ) : <span className="text-white/25 text-xs">—</span>}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isDone
                          ? inq.outcome === 'won' ? 'bg-emerald-400' : 'bg-white/30'
                          : 'bg-amber-400 animate-pulse'
                      }`} />
                      <span className={`text-xs ${
                        isDone
                          ? inq.outcome === 'won' ? 'text-emerald-400' : 'text-white/40'
                          : 'text-amber-400'
                      }`}>
                        {isDone
                          ? inq.outcome === 'won' ? 'Спечелен' : 'Загубен'
                          : 'Активно'}
                      </span>
                    </div>
                    {!isDone && ageDays > 3 && (
                      <span className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-red-400/10 border border-red-400/20 text-red-400 w-fit">
                        ⏰ {ageDays} дни
                      </span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 align-top">
                    {!isDone ? (
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleOutcome(inq.id, 'won')}
                          className="px-2.5 py-1 rounded-md text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/25 transition-colors"
                        >
                          ✓ Спечелен
                        </button>
                        <button
                          onClick={() => handleOutcome(inq.id, 'lost')}
                          className="px-2.5 py-1 rounded-md text-xs bg-red-400/10 border border-red-400/25 text-red-400 hover:bg-red-400/20 transition-colors"
                        >
                          ✗ Загубен
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleReopen(inq.id)}
                          className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-colors"
                        >
                          Върни
                        </button>
                        <button
                          onClick={() => handleDelete(inq.id)}
                          className="px-2.5 py-1 rounded-md text-xs bg-red-400/10 border border-red-400/20 text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          Изтрий
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
