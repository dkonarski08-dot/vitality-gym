// app/(dashboard)/layout.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    // Check session from localStorage (simple auth for now)
    const stored = localStorage.getItem('vitality_session')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        router.push('/login')
      }
    } else {
      router.push('/login')
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('vitality_session')
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        onLogout={handleLogout}
      />
      <main className="ml-[240px] min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
