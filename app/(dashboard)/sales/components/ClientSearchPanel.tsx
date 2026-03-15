'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Client } from '@/src/types/database'
import { ClientCard } from '../../clients/components/ClientCard'

interface Props {
  selectedClient: Client | null
  onClientSelect: (client: Client | null) => void
}

const DISCOUNT_PCT: Record<string, number> = { none: 0, standard: 5, vip: 10 }

export function ClientSearchPanel({ selectedClient, onClientSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [searching, setSearching] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) {
        setResults(data.clients ?? [])
        setShowDropdown(true)
      }
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const handleSelect = (client: Client) => {
    onClientSelect(client)
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  const handleDeselect = () => {
    onClientSelect(null)
    setQuery('')
  }

  const handleCreateClient = async () => {
    if (!quickName.trim() || !quickPhone.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickName.trim(), phone: quickPhone.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.client) {
        onClientSelect(data.client)
        setShowQuickForm(false)
        setQuickName('')
        setQuickPhone('')
      }
    } finally {
      setSaving(false)
    }
  }

  const discountPct = selectedClient ? DISCOUNT_PCT[selectedClient.discount_tier] ?? 0 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-white/60 font-medium">👤 Клиент</div>

      {selectedClient ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <ClientCard client={selectedClient} compact />
          {discountPct > 0 && (
            <div className="mt-2 text-xs text-amber-400/80">
              Авт. отстъпка: {discountPct}%
            </div>
          )}
          <button
            onClick={handleDeselect}
            className="mt-2 text-xs text-white/40 hover:text-red-400 transition-colors"
          >
            ✕ Премахни клиент
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Търси клиент..."
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
          {searching && (
            <div className="absolute right-3 top-2.5">
              <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0f0f14] border border-white/[0.1] rounded-xl overflow-hidden shadow-xl">
              {results.map(client => (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className="w-full px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.05] last:border-0"
                >
                  <ClientCard client={client} compact />
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0f0f14] border border-white/[0.1] rounded-xl p-3 shadow-xl">
              <div className="text-white/40 text-xs text-center">Няма намерени клиенти</div>
            </div>
          )}
          {!query && (
            <div className="mt-2 text-center text-white/30 text-xs py-4">
              Избери или търси клиент
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setShowQuickForm(v => !v)}
        className="text-xs text-amber-400 hover:text-amber-300 transition-colors self-start"
      >
        {showQuickForm ? '✕ Откажи' : '+ Нов клиент'}
      </button>

      {showQuickForm && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
          <input
            type="text"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Ime и фамилия"
            className="px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
          <input
            type="text"
            value={quickPhone}
            onChange={e => setQuickPhone(e.target.value)}
            placeholder="Телефон"
            className="px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
          <button
            onClick={handleCreateClient}
            disabled={saving || !quickName.trim() || !quickPhone.trim()}
            className="py-2 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm rounded-lg hover:bg-amber-400/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Записване...' : 'Създай'}
          </button>
        </div>
      )}
    </div>
  )
}
