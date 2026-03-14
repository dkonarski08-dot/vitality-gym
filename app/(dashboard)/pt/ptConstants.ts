// app/(dashboard)/pt/ptConstants.ts
// Shared label maps and utilities for all PT components

export const GOAL_LABELS: Record<string, string> = {
  weight_loss:     '⚖️ Отслабване',
  muscle:          '💪 Мускулна маса',
  cardio:          '🏃 Кардио',
  rehab:           '🩺 Рехабилитация',
  general:         '✨ Обща форма',
  // Legacy Bulgarian text stored directly in DB
  'отслабване':    '⚖️ Отслабване',
  'мускулна маса': '💪 Мускулна маса',
  'кардио':        '🏃 Кардио',
  'рехабилитация': '🩺 Рехабилитация',
  'обща форма':    '✨ Обща форма',
}

export const DAY_LABELS: Record<string, string> = {
  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Нд',
}

export const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '🌅 Сутрин',
  afternoon: '☀️ Обяд',
  evening: '🌙 Вечер',
}

// Picker arrays — used in PTClientModal and PTInquiryModal
export const PT_DAYS = [
  { value: 'monday',    label: 'Пн' },
  { value: 'tuesday',   label: 'Вт' },
  { value: 'wednesday', label: 'Ср' },
  { value: 'thursday',  label: 'Чт' },
  { value: 'friday',    label: 'Пт' },
  { value: 'saturday',  label: 'Сб' },
  { value: 'sunday',    label: 'Нд' },
]

export const PT_TIME_SLOTS = [
  { key: 'morning',   label: 'Сутрин', range: '8:00 – 12:00',  emoji: '🌅' },
  { key: 'afternoon', label: 'Обяд',   range: '12:00 – 16:00', emoji: '☀️' },
  { key: 'evening',   label: 'Вечер',  range: '16:00 – 20:00', emoji: '🌙' },
]

export const PT_GOALS = [
  { key: 'weight_loss', label: '⚖️ Отслабване и стройност' },
  { key: 'muscle',      label: '💪 Мускулна маса и сила' },
  { key: 'cardio',      label: '🏃 Кардио и издръжливост' },
  { key: 'rehab',       label: '🩺 Рехабилитация и здраве' },
  { key: 'general',     label: '✨ Обща форма и тонус' },
]

export const PT_SOURCES = [
  { key: 'facebook',  label: '📘 Фейсбук' },
  { key: 'instagram', label: '📸 Инстаграм' },
  { key: 'google',    label: '🔍 Гугъл' },
  { key: 'friend',    label: '👥 Приятел' },
  { key: 'nearby',    label: '📍 Живея наблизо' },
]

export function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Client urgency utilities ─────────────────────────────────────────────────

import type { PTClient, PTPackage } from './page'

export type Urgency = 'expired' | 'low' | 'expiring' | 'ok' | 'no_package'

export function getActivePkg(client: PTClient): PTPackage | undefined {
  const actives = client.packages?.filter(p => p.active) ?? []
  return (
    actives.find(p => {
      const remaining = p.total_sessions - p.used_sessions
      const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false
      return !expired && remaining > 0
    }) ?? actives[0]
  )
}

export function getUrgency(client: PTClient): Urgency {
  const pkg = getActivePkg(client)
  if (!pkg) return 'no_package'
  const remaining = pkg.total_sessions - pkg.used_sessions
  const isExpired = pkg.expires_at ? new Date(pkg.expires_at) < new Date() : false
  if (isExpired || remaining === 0) return 'expired'
  if (remaining <= 2) return 'low'
  const daysLeft = pkg.expires_at
    ? Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / 86400000)
    : null
  if (daysLeft !== null && daysLeft <= 7) return 'expiring'
  return 'ok'
}

export function sortClients(clients: PTClient[]): PTClient[] {
  const urgencyOrder: Record<Urgency, number> = { expired: 0, low: 1, expiring: 2, no_package: 3, ok: 4 }
  return [...clients].sort((a, b) => {
    if (!a.active && b.active) return 1
    if (a.active && !b.active) return -1
    const ua = urgencyOrder[getUrgency(a)]
    const ub = urgencyOrder[getUrgency(b)]
    if (ua !== ub) return ua - ub
    return a.name.localeCompare(b.name, 'bg')
  })
}
