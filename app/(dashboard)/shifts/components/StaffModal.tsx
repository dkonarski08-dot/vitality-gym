'use client'
// app/(dashboard)/shifts/components/StaffModal.tsx
import { useState, useEffect } from 'react'
import { Staff, STAFF_ROLES } from '../utils'

interface Props {
  mode: 'add' | 'edit'
  staff?: Staff
  saving: boolean
  onSubmit: (name: string, role: string, phone: string) => void
  onToggleActive?: () => void
  onClose: () => void
}

export function StaffModal({ mode, staff, saving, onSubmit, onToggleActive, onClose }: Props) {
  const [name, setName] = useState(staff?.name ?? '')
  const [role, setRole] = useState(staff?.role ?? 'Reception')
  const [phone, setPhone] = useState(staff?.phone ?? '')

  useEffect(() => {
    setName(staff?.name ?? '')
    setRole(staff?.role ?? 'Reception')
    setPhone(staff?.phone ?? '')
  }, [staff])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-white mb-5">
          {mode === 'add' ? 'Нов служител' : 'Редактирай служител'}
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Име</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Име и фамилия"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Роля</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Телефон</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-2">
          {mode === 'edit' && staff && onToggleActive && (
            <button onClick={onToggleActive}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium border ${staff.active ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
              {staff.active ? 'Деактивирай' : 'Активирай'}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">Откажи</button>
          <button onClick={() => onSubmit(name.trim(), role, phone.trim())} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 disabled:opacity-40">
            {saving ? '...' : mode === 'add' ? 'Добави' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
