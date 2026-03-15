import { useState, useEffect } from 'react'

type UserRole = 'admin' | 'receptionist' | 'instructor' | 'cleaning'

interface SessionState {
  userRole: UserRole
  userName: string
  employeeId: string | null
}

export function useSession(): SessionState {
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const [userName, setUserName] = useState('')
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  useEffect(() => {
    const s = localStorage.getItem('vitality_session')
    if (s) {
      // Default to 'receptionist' on parse failure, never 'admin'
      try {
        const p = JSON.parse(s)
        setUserRole(p.role ?? 'receptionist')
        setUserName(p.name ?? '')
        setEmployeeId(p.employeeId ?? null)
      }
      catch { setUserRole('receptionist') }
    } else {
      setUserRole('receptionist')
    }
  }, [])

  return { userRole, userName, employeeId }
}
