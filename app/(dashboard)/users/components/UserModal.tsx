// app/(dashboard)/users/components/UserModal.tsx
'use client'
import { useState } from 'react'
import { AppUser } from '@/src/types/database'

interface UserModalProps {
  user?: AppUser
  onSave: () => void
  onClose: () => void
}

type RoleValue = 'admin' | 'receptionist' | 'instructor'

const ROLES: { value: RoleValue; label: string; icon: string; selectedClass: string }[] = [
  { value: 'admin',        label: 'Админ',      icon: '👑', selectedClass: 'border-amber-400 bg-amber-400/[0.08]' },
  { value: 'receptionist', label: 'Рецепция',   icon: '🖥',  selectedClass: 'border-sky-400 bg-sky-400/[0.08]' },
  { value: 'instructor',   label: 'Инструктор', icon: '💪', selectedClass: 'border-emerald-400 bg-emerald-400/[0.08]' },
]

export default function UserModal({ user, onSave, onClose }: UserModalProps) {
  const isEdit = !!user

  const [role, setRole] = useState<RoleValue>(user?.role ?? 'receptionist')
  const [name, setName] = useState(user?.name ?? '')
  const [pin, setPin] = useState('')
  // pinDirty: in edit mode, true once user types the first digit (clears placeholder)
  const [pinDirty, setPinDirty] = useState(false)
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? '')
  const [hiredAt, setHiredAt] = useState(user?.hired_at ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4) return
    if (isEdit && !pinDirty) {
      // First digit in edit mode: clear the placeholder and start fresh
      setPin(digit)
      setPinDirty(true)
    } else {
      setPin(prev => prev + digit)
    }
  }

  const handlePinDelete = () => {
    if (isEdit && !pinDirty) return   // nothing to delete when showing placeholder
    setPin(prev => prev.slice(0, -1))
    if (pin.length <= 1) setPinDirty(false)
  }

  const validate = (): string => {
    if (!role) return 'Изберете роля'
    if (!name.trim()) return 'Въведете потребителско име'
    if (!isEdit && pin.length !== 4) return 'PIN кодът трябва да е 4 цифри'
    if (pin.length > 0 && pin.length !== 4) return 'PIN кодът трябва да е 4 цифри'
    return ''
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        hired_at: hiredAt || null,
      }
      // Only send PIN if user entered a new one (or it's a new user)
      if (!isEdit || (pinDirty && pin.length === 4)) {
        body.pin = pin
      }
      const url = isEdit ? `/api/users/${user!.id}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Грешка при запазване'); return }
      onSave()
    } catch {
      setError('Мрежова грешка')
    } finally {
      setSaving(false)
    }
  }

  // How many dots to show filled:
  // - New user or pinDirty=true: actual pin.length
  // - Edit mode, not yet typed: 4 (placeholder dots)
  const filledDots = (isEdit && !pinDirty) ? 4 : pin.length

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-[20px] w-full max-w-[460px] p-7" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-[18px] font-bold text-white">
            {isEdit ? `Редакция — ${user.name}` : 'Нов потребител'}
          </h3>
          <p className="text-[12px] text-white/40 mt-1">
            {isEdit ? 'Промени данните и запази' : 'Попълни данните за новия акаунт'}
          </p>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.1em] mb-4">Достъп</p>

        {/* Role */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-2">Роля</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`rounded-[10px] border-2 p-3 text-center transition-colors ${role === r.value ? r.selectedClass : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'}`}
              >
                <div className="text-[22px] mb-1">{r.icon}</div>
                <div className="text-[11px] font-semibold text-white/70">{r.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Потребителско име</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Напр. Мария"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/[0.2]"
          />
        </div>

        {/* PIN */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-2">
            PIN код{isEdit ? ' (остави празно за без промяна)' : ''}
          </label>
          <div className="flex gap-2 justify-center mb-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-[42px] h-[42px] rounded-[10px] border-2 flex items-center justify-center transition-all ${i < filledDots ? 'border-amber-400/50 bg-amber-400/[0.1]' : 'border-white/[0.1] bg-white/[0.03]'}`}>
                {i < filledDots && <div className="w-[11px] h-[11px] rounded-full bg-amber-400" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i} onClick={() => d === '⌫' ? handlePinDelete() : d ? handlePinDigit(d) : undefined}
                disabled={!d}
                className={`h-11 rounded-[9px] text-base font-medium transition-all ${!d ? 'invisible' : d === '⌫' ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]' : 'text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] active:scale-95'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/[0.06] my-5" />
        <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.1em] mb-4">Профилна информация</p>

        {/* Phone */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Телефонен номер</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+359 88 ..."
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/[0.2]"
          />
        </div>

        {/* Birth date + Hired at */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Рождена дата</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white/80 outline-none focus:border-white/[0.2]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Нает на</label>
            <input type="date" value={hiredAt} onChange={e => setHiredAt(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white/80 outline-none focus:border-white/[0.2]"
            />
          </div>
        </div>

        {error && <p className="text-[13px] text-red-400/80 mb-4">{error}</p>}

        <div className="flex gap-2.5 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-[12px] border border-white/[0.1] text-white/50 font-semibold text-[13px] hover:text-white/70 transition-colors">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-3 rounded-[12px] bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-[13px] disabled:opacity-50 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
            {saving ? 'Запазвам...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
