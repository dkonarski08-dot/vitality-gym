'use client'

import { useState, useEffect } from 'react'
import { getTodayISO } from '@/lib/formatters'
import type { ServiceType, BusinessUnit } from '@/src/types/database'

interface Props {
  businessUnit: BusinessUnit
  clientSelected: boolean
  onAddService: (service: ServiceType, startDate?: string) => void
}

export function ServiceGrid({ businessUnit, clientSelected, onAddService }: Props) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [datePicker, setDatePicker] = useState<ServiceType | null>(null)
  const [selectedDate, setSelectedDate] = useState(getTodayISO())

  useEffect(() => {
    setLoading(true)
    setActiveCategory('all')
    fetch(`/api/service-types?business_unit=${businessUnit}`)
      .then(r => r.json())
      .then(data => {
        if (data.service_types) setServiceTypes(data.service_types)
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false))
  }, [businessUnit])

  const categories = ['all', ...Array.from(new Set(serviceTypes.map(s => s.category)))]

  const filtered = activeCategory === 'all'
    ? serviceTypes
    : serviceTypes.filter(s => s.category === activeCategory)

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-white/[0.03] border border-white/10 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (serviceTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <div className="text-4xl mb-3">🗂️</div>
        <div className="text-sm">Няма услуги за {businessUnit === 'gym' ? 'GYM' : 'HALL'}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category pills */}
      <div className="flex gap-1 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              activeCategory === cat
                ? 'bg-amber-400/20 text-amber-400 border-amber-400/30'
                : 'bg-white/[0.03] text-white/50 border-white/10 hover:text-white/80'
            }`}
          >
            {cat === 'all' ? 'Всички' : cat}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map(service => {
          const disabled = !clientSelected
          return (
            <div key={service.id} className="relative">
              <button
                onClick={() => {
                  if (disabled) return
                  if (service.integration_type === 'membership') {
                    setDatePicker(service)
                  } else {
                    onAddService(service)
                  }
                }}
                disabled={disabled}
                title={disabled ? 'Избери клиент първо' : undefined}
                className={`w-full p-3 bg-white/[0.03] border border-white/10 rounded-xl text-left transition-all ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-white/[0.07] hover:border-amber-400/30'
                }`}
              >
                <div className="text-xs text-white/40 mb-1 truncate">{service.category}</div>
                <div className="text-sm font-medium text-white/90 leading-tight mb-2 line-clamp-2">
                  {service.name}
                </div>
                <div className="text-amber-400 font-semibold text-sm">€{service.price.toFixed(2)}</div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Date picker popover */}
      {datePicker && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-5 w-72 shadow-2xl">
            <div className="text-sm font-semibold text-white mb-4">
              {datePicker.name}
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-xs text-white/60">Начална дата</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    onAddService(datePicker, selectedDate)
                    setDatePicker(null)
                    setSelectedDate(getTodayISO())
                  }}
                  className="flex-1 py-2 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm rounded-lg hover:bg-amber-400/30 transition-colors"
                >
                  Добави
                </button>
                <button
                  onClick={() => { setDatePicker(null); setSelectedDate(getTodayISO()) }}
                  className="px-4 py-2 bg-white/[0.05] border border-white/10 text-white/60 text-sm rounded-lg hover:text-white transition-colors"
                >
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
