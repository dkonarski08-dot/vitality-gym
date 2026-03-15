// app/(dashboard)/users/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { AppUser } from '@/src/types/database'
import UserCard from './components/UserCard'
import UserModal from './components/UserModal'

export default function UsersPage() {
  const { userRole } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalUser, setModalUser] = useState<AppUser | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)

  // Role guard — useSession reads from localStorage (may be empty on first render)
  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      router.replace('/')
    }
  }, [userRole, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setFetchError('Грешка при зареждане. Опитай отново.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleToggleActive = async (user: AppUser) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error ?? 'Грешка')
    }
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)
  const activeAdminCount = activeUsers.filter(u => u.role === 'admin').length

  const openAdd = () => { setModalUser(undefined); setModalOpen(true) }
  const openEdit = (u: AppUser) => { setModalUser(u); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)
  const onSave = () => { closeModal(); fetchUsers() }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-36 bg-white/[0.06] rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[160px] bg-white/[0.03] rounded-[14px] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-white/60">{fetchError}</p>
        <button onClick={fetchUsers}
          className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] text-sm font-medium transition-colors">
          Опитай отново
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white">Потребители</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {activeUsers.length} активни · {inactiveUsers.length} неактивни
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-[13px] px-4 py-2.5 rounded-[10px] hover:shadow-lg hover:shadow-amber-500/20 transition-all">
          + Нов потребител
        </button>
      </div>

      {activeUsers.length > 0 && (
        <section className="mb-6">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">
            Активни ({activeUsers.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeUsers.map(u => (
              <UserCard key={u.id} user={u}
                isLastAdmin={u.role === 'admin' && activeAdminCount === 1}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </section>
      )}

      {inactiveUsers.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">
            Неактивни ({inactiveUsers.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactiveUsers.map(u => (
              <UserCard key={u.id} user={u}
                isLastAdmin={false}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </section>
      )}

      {modalOpen && (
        <UserModal user={modalUser} onSave={onSave} onClose={closeModal} />
      )}
    </div>
  )
}
