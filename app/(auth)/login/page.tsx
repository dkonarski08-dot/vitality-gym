// app/(auth)/login/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LoginUser { id: string; name: string; role: string }

export default function LoginPage() {
  const router = useRouter()
  const [users, setUsers] = useState<LoginUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)   // login in-flight guard

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/auth/users')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleLogin = async () => {
    if (!selectedUser || loading) return   // loading guard prevents double-submit
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Грешка при вход'); return }
      localStorage.setItem('vitality_session', JSON.stringify({
        name: data.name,
        role: data.role,
        employeeId: data.employeeId,
      }))
      const landingPage = data.role === 'admin' || data.role === 'instructor' ? '/hall' : '/shifts'
      router.push(landingPage)
    } catch {
      setError('Мрежова грешка')
    } finally {
      setLoading(false)
    }
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) { setPin(p => p + digit); setError('') }
  }
  const handlePinDelete = () => { setPin(p => p.slice(0, -1)); setError('') }

  const roleColor: Record<string, string> = {
    admin: 'from-amber-400 to-orange-500',
    receptionist: 'from-sky-400 to-blue-500',
    instructor: 'from-emerald-400 to-green-500',
  }
  const roleLabel: Record<string, string> = {
    admin: 'Админ',
    receptionist: 'Рецепция',
    instructor: 'Инструктор',
  }

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center font-black text-[#0a0a0f] text-2xl mx-auto mb-4 shadow-lg shadow-amber-500/20">V</div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vitality Gym</h1>
          <p className="text-xs text-white/30 mt-1 uppercase tracking-[0.2em]">Management System</p>
        </div>

        {/* Loading skeleton */}
        {loadingUsers && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[60px] rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}

        {/* Fetch error */}
        {!loadingUsers && loadError && (
          <div className="text-center space-y-4">
            <p className="text-sm text-white/50">Грешка при зареждане. Опитай отново.</p>
            <button onClick={fetchUsers}
              className="px-4 py-2 rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.1] text-sm font-medium transition-colors">
              Опитай отново
            </button>
          </div>
        )}

        {/* User selection */}
        {!loadingUsers && !loadError && !selectedUser && (
          <div className="space-y-2">
            <div className="text-xs text-white/30 uppercase tracking-widest mb-4 text-center">Избери профил</div>
            {users.map(user => (
              <button key={user.id} onClick={() => setSelectedUser(user.name)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleColor[user.role] ?? 'from-white/20 to-white/10'} flex items-center justify-center font-bold text-[#0a0a0f] text-sm`}>
                  {user.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{user.name}</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">{roleLabel[user.role] ?? user.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* PIN entry */}
        {!loadingUsers && !loadError && selectedUser && (
          <div>
            <button onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
              className="flex items-center gap-3 mb-8 text-white/40 hover:text-white/60 transition-colors">
              <span className="text-sm">←</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleColor[users.find(u => u.name === selectedUser)?.role ?? ''] ?? 'from-white/20 to-white/10'} flex items-center justify-center font-bold text-[#0a0a0f] text-xs`}>
                {selectedUser.charAt(0)}
              </div>
              <span className="text-sm">{selectedUser}</span>
            </button>

            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'border-amber-400/50 bg-amber-400/10' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                  {i < pin.length && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                </div>
              ))}
            </div>

            {error && <div className="text-center text-red-400/80 text-sm mb-4">{error}</div>}

            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(digit => (
                <button key={digit || 'empty'}
                  onClick={() => { if (digit === '⌫') handlePinDelete(); else if (digit) handlePinInput(digit) }}
                  disabled={!digit || loading}
                  className={`h-14 rounded-xl text-lg font-medium transition-all ${!digit ? 'invisible' : digit === '⌫' ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]' : 'text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] active:scale-95'}`}
                >
                  {digit}
                </button>
              ))}
            </div>

            <button onClick={handleLogin} disabled={pin.length !== 6 || loading}
              className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-amber-500/20 transition-all active:scale-[0.98]">
              {loading ? 'Влизам...' : 'Влез'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
