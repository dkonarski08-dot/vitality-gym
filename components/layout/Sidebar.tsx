// components/layout/Sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavForRole } from '@/src/modules/common/navigation'

interface SidebarProps {
  userRole: string
  userName: string
  onLogout: () => void
}

export default function Sidebar({ userRole, userName, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const navItems = getNavForRole(userRole)

  const roleLabel: Record<string, string> = {
    admin: 'Администратор',
    receptionist: 'Рецепция',
    instructor: 'Инструктор',
  }

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-[#0a0a0f] border-r border-white/[0.06] flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center font-black text-[#0a0a0f] text-sm shrink-0">
          V
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-semibold text-sm text-white tracking-tight">Vitality Gym</div>
            <div className="text-[10px] text-white/30 uppercase tracking-widest">Management</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-thin">
        <div className="space-y-0.5">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative
                  ${isActive
                    ? 'bg-white/[0.08] text-amber-400'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base shrink-0 w-6 text-center">{item.icon}</span>
                {!collapsed && (
                  <span className={`truncate ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
                )}
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto bg-red-500/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-amber-400 rounded-r-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User + collapse */}
      <div className="border-t border-white/[0.06] p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs font-bold text-white/60">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-white/70 truncate">{userName}</div>
              <div className="text-[10px] text-white/30">{roleLabel[userRole] || userRole}</div>
            </div>
          </div>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 p-2 rounded-lg text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-colors text-xs text-center"
          >
            {collapsed ? '→' : '←'}
          </button>
          {!collapsed && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-white/20 hover:text-red-400/60 hover:bg-white/[0.04] transition-colors text-xs"
            >
              Изход
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
