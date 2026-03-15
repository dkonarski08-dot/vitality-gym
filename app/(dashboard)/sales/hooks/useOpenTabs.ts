'use client'
import { useState, useCallback } from 'react'
import type { OpenTab } from '@/src/types/database'

export function useOpenTabs() {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/open-tabs')
      const json = await res.json()
      if (res.ok) setTabs(json.open_tabs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const payTab = useCallback(async (tabId: string, paymentMethod: 'cash' | 'card') => {
    const res = await fetch('/api/open-tabs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'pay_tab', tab_id: tabId, payment_method: paymentMethod }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    await load()
    return json.sale
  }, [load])

  const deleteTab = useCallback(async (tabId: string) => {
    const res = await fetch('/api/open-tabs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_tab', tab_id: tabId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Грешка при изтриване')
    await load()
  }, [load])

  return { tabs, loading, load, payTab, deleteTab }
}
