'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ServiceType, BusinessUnit, IntegrationType } from '@/src/types/database'

const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  membership: 'Абонамент',
  pt_package: 'PT Пакет',
  pt_single: 'PT Единична',
  service_record: 'Услуга',
  hall_entry: 'Hall вход',
}

const BU_LABELS: Record<BusinessUnit, string> = {
  gym: 'GYM',
  hall: 'HALL',
}

interface ServiceForm {
  name: string
  price: string
  category: string
  business_unit: BusinessUnit
  integration_type: IntegrationType
  duration_days: string
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  price: '',
  category: '',
  business_unit: 'gym',
  integration_type: 'service_record',
  duration_days: '',
}

interface Props {
  userRole: string
}

export function ServiceCatalogAdmin({ userRole }: Props) {
  const [services, setServices] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState<ServiceForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ServiceForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/service-types')
      const data = await res.json()
      if (res.ok) setServices(data.service_types ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center py-16 text-white/40 text-sm">
        Само администратори могат да управляват каталога.
      </div>
    )
  }

  const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean)))

  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.price) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newForm.name.trim(),
          price: parseFloat(newForm.price),
          category: newForm.category.trim(),
          business_unit: newForm.business_unit,
          integration_type: newForm.integration_type,
          duration_days: newForm.duration_days ? parseInt(newForm.duration_days) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setNewForm(EMPTY_FORM)
      setShowNewForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id,
          name: editForm.name.trim(),
          price: parseFloat(editForm.price),
          category: editForm.category.trim(),
          business_unit: editForm.business_unit,
          integration_type: editForm.integration_type,
          duration_days: editForm.duration_days ? parseInt(editForm.duration_days) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (service: ServiceType) => {
    try {
      const res = await fetch('/api/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: service.id, active: !service.active }),
      })
      if (res.ok) {
        setServices(prev =>
          prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s)
        )
      }
    } catch {
      // silent
    }
  }

  const startEdit = (service: ServiceType) => {
    setEditingId(service.id)
    setEditForm({
      name: service.name,
      price: String(service.price),
      category: service.category,
      business_unit: service.business_unit,
      integration_type: service.integration_type,
      duration_days: service.duration_days ? String(service.duration_days) : '',
    })
  }

  const grouped = categories.length > 0
    ? categories.reduce<Record<string, ServiceType[]>>((acc, cat) => {
        acc[cat] = services.filter(s => s.category === cat)
        return acc
      }, {})
    : { 'Всички': services }

  const renderForm = (
    form: ServiceForm,
    setForm: (f: ServiceForm) => void,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string
  ) => (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-white/60 mb-1 block">Наименование</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            placeholder="Наименование на услугата"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Цена €</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Категория</label>
          <input
            type="text"
            list="categories-list"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            placeholder="Категория"
          />
          <datalist id="categories-list">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Business Unit</label>
          <select
            value={form.business_unit}
            onChange={e => setForm({ ...form, business_unit: e.target.value as BusinessUnit })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
          >
            <option value="gym">GYM</option>
            <option value="hall">HALL</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Тип интеграция</label>
          <select
            value={form.integration_type}
            onChange={e => setForm({ ...form, integration_type: e.target.value as IntegrationType })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
          >
            {(Object.entries(INTEGRATION_LABELS) as [IntegrationType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {form.integration_type === 'membership' && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Срок в дни</label>
            <input
              type="number"
              min="1"
              value={form.duration_days}
              onChange={e => setForm({ ...form, duration_days: e.target.value })}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
              placeholder="30"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm rounded-lg hover:bg-amber-400/30 transition-colors disabled:opacity-40"
        >
          {saving ? 'Записване...' : saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/[0.05] border border-white/10 text-white/60 text-sm rounded-lg hover:text-white transition-colors"
        >
          Отказ
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Каталог услуги</h2>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="px-4 py-2 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm rounded-lg hover:bg-amber-400/30 transition-colors"
        >
          + Нова услуга
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {showNewForm && renderForm(
        newForm,
        setNewForm,
        handleCreate,
        () => { setShowNewForm(false); setNewForm(EMPTY_FORM) },
        'Създай'
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}

      {!loading && Object.entries(grouped).map(([cat, catServices]) => (
        <div key={cat}>
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">{cat}</div>
          <div className="space-y-2">
            {catServices.map(service => (
              <div key={service.id}>
                {editingId === service.id ? (
                  renderForm(
                    editForm,
                    setEditForm,
                    () => handleUpdate(service.id),
                    () => setEditingId(null),
                    'Запази'
                  )
                ) : (
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${service.active ? 'text-white' : 'text-white/40 line-through'}`}>
                          {service.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white/50">
                          {BU_LABELS[service.business_unit]}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400">
                          {INTEGRATION_LABELS[service.integration_type]}
                        </span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {service.category} {service.duration_days ? `• ${service.duration_days} дни` : ''}
                      </div>
                    </div>
                    <div className="text-amber-400 font-semibold text-sm shrink-0">
                      €{service.price.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleActive(service)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          service.active
                            ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20'
                            : 'bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70'
                        }`}
                      >
                        {service.active ? 'Активна' : 'Неактивна'}
                      </button>
                      <button
                        onClick={() => startEdit(service)}
                        className="text-xs px-2 py-1 rounded border border-white/[0.08] text-white/40 hover:text-amber-400 hover:border-amber-400/30 transition-colors"
                      >
                        Редактирай
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
