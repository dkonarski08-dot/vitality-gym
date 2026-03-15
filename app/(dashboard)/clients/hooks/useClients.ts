'use client'
import { useState, useCallback } from 'react'
import type { Client } from '@/src/types/database'

export function useClients() {
  const [results, setResults] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResults(json.clients)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Грешка')
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (data: { name: string; phone: string; discount_tier?: string; notes?: string }) => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    return json.client as Client
  }, [])

  const update = useCallback(async (id: string, data: Partial<Pick<Client, 'name' | 'phone' | 'discount_tier' | 'notes'>>) => {
    const res = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    return json.client as Client
  }, [])

  return { results, loading, error, search, create, update }
}
