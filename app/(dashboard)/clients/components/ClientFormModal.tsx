'use client'
import { useState, useEffect } from 'react'
import type { Client, DiscountTier } from '@/src/types/database'

const DISCOUNT_OPTIONS: { value: DiscountTier; label: string }[] = [
  { value: 'none', label: 'Без отстъпка' },
  { value: 'standard', label: 'Стандартна (5%)' },
  { value: 'vip', label: 'VIP (10%)' },
]

interface Props {
  client?: Client | null
  onSave: (data: { name: string; phone: string; discount_tier: DiscountTier; notes: string }) => Promise<void>
  onClose: () => void
}

export function ClientFormModal({ client, onSave, onClose }: Props) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [discountTier, setDiscountTier] = useState<DiscountTier>(client?.discount_tier ?? 'none')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Името и телефонът са задължителни')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), discount_tier: discountTier, notes: notes.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запис')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">
            {client ? 'Редактирай клиент' : 'Нов клиент'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-xl leading-none">✕</button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Име *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Три имена"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-1.5">Телефон *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+359..."
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-1.5">Тип отстъпка</label>
            <select
              value={discountTier}
              onChange={e => setDiscountTier(e.target.value as DiscountTier)}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
            >
              {DISCOUNT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#0f0f14]">{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-1.5">Бележки</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Допълнителна информация..."
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/60 text-sm hover:text-white/80 transition-colors"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm font-medium hover:bg-amber-400/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Записване...' : 'Запази'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
