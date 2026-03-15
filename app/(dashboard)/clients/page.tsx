'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useClients } from './hooks/useClients'
import { ClientCard } from './components/ClientCard'
import { ClientFormModal } from './components/ClientFormModal'
import type { Client } from '@/src/types/database'

export default function ClientsPage() {
  const { userRole } = useSession()
  const { results, loading, error, search, create, update } = useClients()
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canEdit = userRole === 'admin' || userRole === 'receptionist'

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { search(query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function openCreate() {
    setEditingClient(null)
    setShowModal(true)
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setShowModal(true)
  }

  async function handleSave(data: { name: string; phone: string; discount_tier: 'none' | 'standard' | 'vip'; notes: string }) {
    if (editingClient) {
      await update(editingClient.id, data)
    } else {
      await create(data)
    }
    search(query)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">👥 Клиенти</h1>
            <p className="text-white/40 text-sm mt-0.5">Управление на клиентска база</p>
          </div>
          {canEdit && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm font-medium hover:bg-amber-400/30 transition-colors"
            >
              + Нов клиент
            </button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Търси по ime или телефон..."
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/40"
          />
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="text-white/40 text-sm">Зареждане...</div>
        ) : query.length < 2 ? (
          <div className="text-white/30 text-sm text-center py-12">
            Въведи поне 2 символа за търсене
          </div>
        ) : results.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-12">
            Няма намерени клиенти за „{query}"
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={canEdit ? () => openEdit(client) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ClientFormModal
          client={editingClient}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
