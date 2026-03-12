'use client'
// app/(dashboard)/deliveries/components/SuppliersTab.tsx

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Supplier } from '@/src/types/deliveries'
import {
  useSuppliers,
  type SupplierFormData,
  EMPTY_SUPPLIER_FORM,
} from '../hooks/useSuppliers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateShort(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''))
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

function formatAmount(n: number): string {
  if (n === 0) return '0.00'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isIncomplete(s: Supplier): boolean {
  return !s.eik || (!s.phone && !s.email) || !s.contact_person
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type SupplierStatus = 'active' | 'incomplete' | 'inactive'

function getStatus(s: Supplier): SupplierStatus {
  if (!s.active) return 'inactive'
  if (isIncomplete(s)) return 'incomplete'
  return 'active'
}

const STATUS_BORDER: Record<SupplierStatus, string> = {
  active: 'border-l-emerald-500/70',
  incomplete: 'border-l-amber-400/70',
  inactive: 'border-l-white/10',
}

const STATUS_BADGE: Record<SupplierStatus, { label: string; classes: string }> = {
  active: {
    label: 'Активен',
    classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  incomplete: {
    label: '⚠ Непълни данни',
    classes: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  },
  inactive: {
    label: 'Неактивен',
    classes: 'bg-white/[0.04] text-white/40 border border-white/10',
  },
}

// ── Input field ───────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
}

function Field({ label, value, onChange, placeholder, required, type = 'text' }: FieldProps) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5 tracking-wide">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.06] transition-colors"
      />
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface SupplierModalProps {
  initial: SupplierFormData
  title: string
  saving: boolean
  onSave: (data: SupplierFormData) => void
  onClose: () => void
}

function SupplierModal({ initial, title, saving, onSave, onClose }: SupplierModalProps) {
  const [form, setForm] = useState<SupplierFormData>(initial)
  const set = (field: keyof SupplierFormData) => (v: string) =>
    setForm(prev => ({ ...prev, [field]: v }))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0f0f14]/95 backdrop-blur border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-2xl leading-none transition-colors">×</button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <Field label="Фирма / Търговско наименование" value={form.name} onChange={set('name')} placeholder="напр. Olimp Sport Nutrition" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="ЕИК / Булстат" value={form.eik} onChange={set('eik')} placeholder="123456789" />
            <Field label="Вид продукти" value={form.product_types} onChange={set('product_types')} placeholder="Протеини, Енергийни напитки" />
          </div>

          <div className="border-t border-white/[0.06] pt-5">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Контакт</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Представител / Търговец" value={form.contact_person} onChange={set('contact_person')} placeholder="Иван Иванов" />
              <Field label="Телефон" value={form.phone} onChange={set('phone')} placeholder="+359 88 888 8888" type="tel" />
              <Field label="Имейл" value={form.email} onChange={set('email')} placeholder="supplier@example.com" type="email" />
              <Field label="Уебсайт" value={form.website} onChange={set('website')} placeholder="https://example.com" />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-5">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Допълнително</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Адрес" value={form.address} onChange={set('address')} placeholder="ул. Примерна 1, гр. Пловдив" />
              </div>
              <Field label="Условия на плащане" value={form.payment_terms} onChange={set('payment_terms')} placeholder="30 дни, при доставка" />
              <div>
                <label className="block text-xs text-white/50 mb-1.5 tracking-wide">Бележки</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Допълнителна информация..."
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-400/50 resize-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0f0f14]/95 backdrop-blur border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            Отказ
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-400 to-orange-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm deactivate ────────────────────────────────────────────────────────

interface ConfirmDeactivateProps {
  supplier: Supplier
  saving: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmDeactivateModal({ supplier, saving, onConfirm, onClose }: ConfirmDeactivateProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <span className="text-red-400 text-lg">⚠</span>
        </div>
        <h2 className="text-sm font-semibold text-white mb-2">Деактивирай доставчик</h2>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Доставчикът <span className="text-white font-medium">{supplier.name}</span> ще бъде скрит от активния списък. Историята на доставките се запазва.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors">
            Отказ
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Деактивиране...' : 'Деактивирай'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  supplier: Supplier
  saving: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onClose: () => void
  visible: boolean
}

function SupplierDrawer({ supplier: s, saving, onEdit, onDeactivate, onReactivate, onClose, visible }: DrawerProps) {
  const status = getStatus(s)
  const badge = STATUS_BADGE[status]

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[380px] bg-[#0b0b10] border-l border-white/[0.07] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-semibold text-white truncate">{s.name}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.classes}`}>
                {badge.label}
              </span>
              {s.eik && (
                <span className="text-[11px] text-white/30">ЕИК: {s.eik}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/60 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-white/[0.06]">
          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-amber-400 tabular-nums">{s.total_deliveries}</div>
            <div className="text-[10px] text-white/35 mt-0.5 leading-tight">доставки</div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-amber-400 tabular-nums leading-6">€{formatAmount(s.total_amount)}</div>
            <div className="text-[10px] text-white/35 mt-0.5 leading-tight">общо</div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-white/70 tabular-nums leading-6">
              {s.total_deliveries > 0 ? `€${formatAmount(s.total_amount / s.total_deliveries)}` : '—'}
            </div>
            <div className="text-[10px] text-white/35 mt-0.5 leading-tight">средно</div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Company info */}
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Фирмени данни</p>
            <div className="space-y-2.5">
              <DetailRow label="ЕИК" value={s.eik} />
              <DetailRow
                label="Уебсайт"
                value={s.website}
                render={v => (
                  <a
                    href={v.startsWith('http') ? v : `https://${v}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    {v.replace(/^https?:\/\//, '')} ↗
                  </a>
                )}
              />
              <DetailRow label="Продукти" value={s.product_types} />
              <DetailRow label="Последна доставка" value={dateShort(s.last_delivery_at)} isText />
              {s.payment_terms && <DetailRow label="Плащане" value={s.payment_terms} />}
              {s.address && <DetailRow label="Адрес" value={s.address} />}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Контакт</p>
            <div className="space-y-2.5">
              <DetailRow label="Представител" value={s.contact_person} />
              <DetailRow
                label="Телефон"
                value={s.phone}
                render={v => (
                  <a href={`tel:${v}`} className="text-sky-400 hover:text-sky-300 transition-colors">{v}</a>
                )}
              />
              <DetailRow
                label="Имейл"
                value={s.email}
                render={v => (
                  <a href={`mailto:${v}`} className="text-sky-400 hover:text-sky-300 transition-colors">{v}</a>
                )}
              />
            </div>
          </div>

          {/* Notes */}
          {s.notes && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Бележки</p>
              <p className="text-sm text-white/60 leading-relaxed">{s.notes}</p>
            </div>
          )}

          {/* Incomplete warning */}
          {status === 'incomplete' && (
            <div className="bg-amber-400/[0.06] border border-amber-400/20 rounded-xl p-3">
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Липсват данни за контакт или ЕИК. Попълни за по-добра проследяемост.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
          <button
            onClick={onEdit}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-400/15 to-orange-500/15 border border-amber-400/25 text-amber-400 hover:from-amber-400/25 hover:to-orange-500/25 transition-all"
          >
            ✏ Редактирай
          </button>
          <div className="grid grid-cols-2 gap-2">
            {s.active ? (
              <button
                onClick={onDeactivate}
                disabled={saving}
                className="py-2 rounded-xl text-sm text-white/40 bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:text-white/60 transition-colors"
              >
                📁 Архивирай
              </button>
            ) : (
              <button
                onClick={onReactivate}
                disabled={saving}
                className="py-2 rounded-xl text-sm text-emerald-400 bg-emerald-500/[0.07] border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
              >
                ↩ Активирай
              </button>
            )}
            <button
              onClick={onDeactivate}
              disabled={saving}
              className="py-2 rounded-xl text-sm text-red-400/70 bg-red-500/[0.05] border border-red-500/15 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              🗑 Изтрий
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface DetailRowProps {
  label: string
  value: string | null | undefined
  isText?: boolean
  render?: (v: string) => React.ReactNode
}

function DetailRow({ label, value, isText, render }: DetailRowProps) {
  if (!value) return null
  return (
    <div className="flex gap-3 items-baseline">
      <span className="text-[11px] text-white/35 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-white/80 flex-1 min-w-0">
        {render && !isText ? render(value) : value}
      </span>
    </div>
  )
}

// ── Supplier row ──────────────────────────────────────────────────────────────

interface RowProps {
  s: Supplier
  selected: boolean
  onClick: () => void
}

function SupplierRow({ s, selected, onClick }: RowProps) {
  const status = getStatus(s)
  const badge = STATUS_BADGE[status]
  const borderColor = STATUS_BORDER[status]

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-l-[3px] ${borderColor} rounded-r-xl transition-all duration-150 group
        ${selected
          ? 'bg-amber-400/[0.06] border-r border-t border-b border-amber-400/20'
          : 'bg-white/[0.02] border-r border-t border-b border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08]'
        }
        ${!s.active ? 'opacity-50' : ''}
      `}
    >
      <div className="px-4 py-3.5 flex items-center gap-4">
        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-sm font-semibold ${selected ? 'text-amber-400' : 'text-white group-hover:text-white/90'} transition-colors`}>
              {s.name}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${badge.classes}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {s.eik && (
              <span className="text-[11px] text-white/30">ЕИК: {s.eik}</span>
            )}
            {s.website && (
              <span className="text-[11px] text-white/30">{s.website.replace(/^https?:\/\//, '')}</span>
            )}
            {s.product_types && (
              <span className="text-[11px] text-white/40 truncate max-w-[200px]">{s.product_types}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-white/80 tabular-nums">{s.total_deliveries}</div>
            <div className="text-[10px] text-white/30">дост.</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white/80 tabular-nums">€{formatAmount(s.total_amount)}</div>
            <div className="text-[10px] text-white/30">общо</div>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-[11px] text-white/40 tabular-nums">{dateShort(s.last_delivery_at)}</div>
            <div className="text-[10px] text-white/25">последна</div>
          </div>
        </div>

        {/* Arrow */}
        <div className={`flex-shrink-0 text-white/20 group-hover:text-white/40 transition-all duration-150 ${selected ? 'text-amber-400/50 translate-x-0.5' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SuppliersTab() {
  const { suppliers, loading, error, saving, createSupplier, updateSupplier, deleteSupplier } = useSuppliers()

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null)
  const drawerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = useMemo(
    () => suppliers.find(s => s.id === selectedId) ?? null,
    [suppliers, selectedId]
  )

  // Animate drawer open/close
  useEffect(() => {
    if (selectedId) {
      // Slight delay so the DOM mounts before we trigger the CSS transition
      drawerTimerRef.current = setTimeout(() => setDrawerVisible(true), 10)
    } else {
      setDrawerVisible(false)
    }
    return () => {
      if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current)
    }
  }, [selectedId])

  const closeDrawer = () => {
    setDrawerVisible(false)
    setTimeout(() => setSelectedId(null), 300)
  }

  // Computed list
  const filtered = useMemo(() => {
    let list = showInactive ? suppliers : suppliers.filter(s => s.active)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.eik ?? '').includes(q) ||
        (s.product_types ?? '').toLowerCase().includes(q) ||
        (s.contact_person ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [suppliers, showInactive, search])

  // Summary stats
  const stats = useMemo(() => {
    const active = suppliers.filter(s => s.active)
    const incomplete = active.filter(s => isIncomplete(s))
    const totalSpend = active.reduce((sum, s) => sum + s.total_amount, 0)
    return { active: active.length, incomplete: incomplete.length, totalSpend }
  }, [suppliers])

  const handleAdd = async (data: SupplierFormData) => {
    const ok = await createSupplier(data)
    if (ok) setIsAddOpen(false)
  }

  const handleEdit = async (data: SupplierFormData) => {
    if (!editTarget) return
    const ok = await updateSupplier(editTarget.id, data)
    if (ok) setEditTarget(null)
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    const ok = await deleteSupplier(deactivateTarget.id)
    if (ok) {
      setDeactivateTarget(null)
      closeDrawer()
    }
  }

  const handleReactivate = async (s: Supplier) => {
    await updateSupplier(s.id, { active: true })
  }

  return (
    <div className="relative">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-white tabular-nums">{stats.active}</div>
          <div className="text-xs text-white/40 mt-0.5">Активни доставчика</div>
        </div>
        <div className={`border rounded-xl px-4 py-3 transition-colors ${stats.incomplete > 0 ? 'bg-amber-400/[0.04] border-amber-400/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className={`text-xl font-bold tabular-nums ${stats.incomplete > 0 ? 'text-amber-400' : 'text-white/40'}`}>
            {stats.incomplete}
          </div>
          <div className="text-xs text-white/40 mt-0.5">Непълни данни</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-white tabular-nums">€{formatAmount(stats.totalSpend)}</div>
          <div className="text-xs text-white/40 mt-0.5">Общо харчове</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Търси по име, ЕИК, продукти..."
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.05] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => setShowInactive(v => !v)}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border flex-shrink-0 ${
            showInactive
              ? 'bg-white/[0.08] text-white/70 border-white/15'
              : 'text-white/35 border-white/[0.07] hover:text-white/50 hover:border-white/10'
          }`}
        >
          {showInactive ? 'Скрий неактивни' : 'Покажи неактивни'}
        </button>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <span className="text-base leading-none">+</span> Добави
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-20">🏢</div>
          <p className="text-sm text-white/30">
            {search ? 'Няма резултати за търсенето' : showInactive ? 'Няма доставчици' : 'Няма активни доставчици'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(s => (
            <SupplierRow
              key={s.id}
              s={s}
              selected={s.id === selectedId}
              onClick={() => {
                if (s.id === selectedId) {
                  closeDrawer()
                } else {
                  setSelectedId(s.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      {selectedId && selected && (
        <SupplierDrawer
          supplier={selected}
          saving={saving}
          visible={drawerVisible}
          onEdit={() => setEditTarget(selected)}
          onDeactivate={() => setDeactivateTarget(selected)}
          onReactivate={() => handleReactivate(selected)}
          onClose={closeDrawer}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <SupplierModal
          initial={{
            name: editTarget.name,
            eik: editTarget.eik || '',
            product_types: editTarget.product_types || '',
            website: editTarget.website || '',
            address: editTarget.address || '',
            payment_terms: editTarget.payment_terms || '',
            contact_person: editTarget.contact_person || '',
            phone: editTarget.phone || '',
            email: editTarget.email || '',
            notes: editTarget.notes || '',
          }}
          title={`Редактирай: ${editTarget.name}`}
          saving={saving}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Add modal */}
      {isAddOpen && (
        <SupplierModal
          initial={EMPTY_SUPPLIER_FORM}
          title="Добави доставчик"
          saving={saving}
          onSave={handleAdd}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <ConfirmDeactivateModal
          supplier={deactivateTarget}
          saving={saving}
          onConfirm={handleDeactivate}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  )
}
