// src/modules/common/navigation.ts
import { NavItem } from '@/src/types/database'

export const NAV_ITEMS: NavItem[] = [
  // Admin + Staff shared
  { key: 'hall', label: 'Vitality Hall', icon: '🏋️', href: '/hall', roles: ['admin', 'instructor'] },
  { key: 'shifts', label: 'Смени', icon: '📅', href: '/shifts', roles: ['admin', 'receptionist', 'instructor'] },
  { key: 'pt', label: 'График ПТ', icon: '💪', href: '/pt', roles: ['admin', 'receptionist', 'instructor'] },
  { key: 'notes', label: 'Бележки', icon: '📝', href: '/notes', roles: ['admin', 'receptionist'] },

  // Receptionist tools
  { key: 'cash', label: 'Дневна каса — Фитнес', icon: '💶', href: '/cash', roles: ['admin'] },
  { key: 'hall-cash', label: 'Дневна каса — Зала', icon: '🎽', href: '/hall-cash', roles: ['admin'] },
  { key: 'daily-report', label: 'Дневен отчет', icon: '🗒️', href: '/daily-report', roles: ['receptionist'] },
  { key: 'deliveries', label: 'Доставки', icon: '📦', href: '/deliveries', roles: ['admin', 'receptionist'] },
  { key: 'requests', label: 'Заявки', icon: '📋', href: '/requests', roles: ['admin', 'receptionist'] },
  { key: 'violations', label: 'Нарушения', icon: '⚠️', href: '/violations', roles: ['admin', 'receptionist'] },
  { key: 'tasks', label: 'Задачи', icon: '✅', href: '/tasks', roles: ['admin', 'receptionist'] },
  { key: 'targets', label: 'Таргети', icon: '🎯', href: '/targets', roles: ['admin', 'receptionist'] },

  // Admin only
  { key: 'payroll', label: 'Заплати', icon: '💰', href: '/payroll', roles: ['admin'] },
  { key: 'clients', label: 'Клиенти', icon: '👥', href: '/clients', roles: ['admin'] },
  { key: 'reports', label: 'Отчети', icon: '📊', href: '/reports', roles: ['admin'] },
  { key: 'email', label: 'Имейл кампании', icon: '📧', href: '/email', roles: ['admin'] },
  { key: 'reviews', label: 'Google Reviews', icon: '⭐', href: '/reviews', roles: ['admin'] },
  { key: 'users', label: 'Потребители', icon: '👤', href: '/users', roles: ['admin'] },
  { key: 'settings', label: 'Настройки', icon: '⚙️', href: '/settings', roles: ['admin'] },
  
]

export function getNavForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter(item => item.roles.includes(role as any))
}
