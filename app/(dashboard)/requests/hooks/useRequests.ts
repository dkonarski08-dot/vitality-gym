// app/(dashboard)/requests/hooks/useRequests.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { DeliveryProduct, DraftItem, DeliveryRequest, AISuggestion } from '../types'

export type ViewMode = 'history' | 'new-request'

export function useRequests() {
  const { userRole, userName } = useSession()

  // Data
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [topProducts, setTopProducts] = useState<DeliveryProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Draft state
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftMonth, setDraftMonth] = useState(new Date().toISOString().slice(0, 7))
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // View
  const [view, setView] = useState<ViewMode>('history')
  const [statusFilter, setStatusFilter] = useState('all')

  // AI suggestions modal
  const [aiModal, setAiModal] = useState<AISuggestion | null>(null)
  const [pendingSubmitId, setPendingSubmitId] = useState<string | null>(null)

  // Admin: clean names
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, topRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/requests?type=top'),
      ])
      const [reqData, topData] = await Promise.all([reqRes.json(), topRes.json()])

      const allRequests: DeliveryRequest[] = reqData.requests || []
      setRequests(allRequests)
      setTopProducts(topData.products || [])

      // Restore existing draft if any
      const draft = allRequests.find(r => r.status === 'draft')
      if (draft) {
        setDraftId(draft.id)
        setDraftMonth(draft.month)
        setDraftItems(draft.delivery_request_items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          note: i.note,
        })))
        setDraftNotes(draft.notes ?? '')
      } else {
        setDraftId(null)
        setDraftItems([])
        setDraftNotes('')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Draft mutations ─────────────────────────────────────────────────────────

  const addProduct = useCallback((name: string, unit: string, productId: string | null) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.product_name === name)
      if (existing) {
        return prev.map(i => i.product_name === name ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product_id: productId, product_name: name, quantity: 1, unit, note: null }]
    })
  }, [])

  const addMultipleProducts = useCallback((items: DraftItem[]) => {
    setDraftItems(prev => {
      let updated = [...prev]
      for (const item of items) {
        const existing = updated.find(i => i.product_name === item.product_name)
        if (existing) {
          updated = updated.map(i =>
            i.product_name === item.product_name ? { ...i, quantity: i.quantity + 1 } : i
          )
        } else {
          updated.push({ ...item, quantity: 1 })
        }
      }
      return updated
    })
  }, [])

  const updateQty = useCallback((idx: number, qty: number) => {
    if (qty <= 0) {
      setDraftItems(prev => prev.filter((_, i) => i !== idx))
    } else {
      setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
    }
  }, [])

  const removeItem = useCallback((idx: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── API calls ───────────────────────────────────────────────────────────────

  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (draftId) return draftId
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_draft', created_by: userName }),
    })
    const data = await res.json()
    const id = data.request?.id ?? null
    if (id) setDraftId(id)
    return id
  }, [draftId, userName])

  const handleNewRequest = useCallback(async () => {
    setView('new-request')
    if (!draftId) {
      const id = await ensureDraft()
      if (id) setDraftId(id)
    }
  }, [draftId, ensureDraft])

  const handleSave = useCallback(async () => {
    if (draftItems.length === 0) return
    setSaving(true)
    try {
      const id = await ensureDraft()
      if (!id) return
      await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', id, notes: draftNotes, items: draftItems }),
      })
    } finally {
      setSaving(false)
    }
  }, [draftItems, draftNotes, ensureDraft])

  const handleSubmit = useCallback(async () => {
    if (draftItems.length === 0) return
    setSubmitting(true)
    try {
      await handleSave()
      const id = draftId
      if (!id) return

      // Phase 1: AI check (force=false). Server keeps status as 'draft' if suggestions exist.
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id, force: false }),
      })
      const data = await res.json()

      if (data.pending && data.suggested_products?.length > 0) {
        // Show AI modal — draft is still in 'draft' status
        setAiModal({ prose: data.ai_suggestions, suggestions: data.suggested_products })
        setPendingSubmitId(id)
        // Do NOT clear draft or switch view — user still needs to act
      } else {
        // No suggestions — submitted immediately
        setDraftId(null)
        setDraftItems([])
        setDraftNotes('')
        setView('history')
        await loadData()
      }
    } finally {
      setSubmitting(false)
    }
  }, [draftItems, draftId, handleSave, loadData])

  // "Добави всички и изпрати": add suggested items to draft, save, then force-submit
  const handleAIAddAndSubmit = useCallback(async (suggestions: { name: string; unit: string }[]) => {
    const id = pendingSubmitId
    setAiModal(null)
    setPendingSubmitId(null)
    if (!id) return

    // Add suggested products to draft state
    const newItems = [...draftItems]
    for (const s of suggestions) {
      const existing = newItems.find(i => i.product_name === s.name)
      if (existing) {
        existing.quantity += 1
      } else {
        newItems.push({ product_id: null, product_name: s.name, quantity: 1, unit: s.unit, note: null })
      }
    }

    // Save updated items then force-submit
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_draft', id, notes: draftNotes, items: newItems }),
    })
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', id, force: true }),
    })

    setDraftId(null)
    setDraftItems([])
    setDraftNotes('')
    setView('history')
    await loadData()
  }, [pendingSubmitId, draftItems, draftNotes, loadData])

  // "Изпрати без промяна": force-submit the draft as-is
  const handleAISubmitWithout = useCallback(async () => {
    const id = pendingSubmitId
    setAiModal(null)
    setPendingSubmitId(null)
    if (!id) return

    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', id, force: true }),
    })

    setDraftId(null)
    setDraftItems([])
    setDraftNotes('')
    setView('history')
    await loadData()
  }, [pendingSubmitId, loadData])

  const handleApprove = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id, approved_by: userName }),
    })
    await loadData()
  }, [userName, loadData])

  const handleReject = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', id }),
    })
    await loadData()
  }, [loadData])

  const handleAddAllToNew = useCallback(async (request: DeliveryRequest) => {
    addMultipleProducts(request.delivery_request_items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note,
    })))
    await handleNewRequest()
  }, [addMultipleProducts, handleNewRequest])

  const handleCleanNames = useCallback(async () => {
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_names' }),
      })
      const data = await res.json()
      setCleanResult(
        data.cleaned > 0
          ? `✓ Генерирани ${data.cleaned} имена`
          : '✓ Няма продукти за обработка'
      )
      if (data.cleaned > 0) await loadData()
      setTimeout(() => setCleanResult(null), 4000)
    } finally {
      setCleaning(false)
    }
  }, [loadData])

  const pastRequests = requests.filter(r => r.status !== 'draft')

  return {
    // Meta
    userRole, loading,
    // View
    view, setView,
    statusFilter, setStatusFilter,
    // Data
    topProducts, pastRequests,
    // Draft
    draftId, draftMonth, draftItems, draftNotes, setDraftNotes,
    saving, submitting,
    // AI modal
    aiModal, pendingSubmitId,
    // Admin
    cleaning, cleanResult,
    // Handlers
    addProduct, addMultipleProducts, updateQty, removeItem,
    handleNewRequest, handleSave, handleSubmit,
    handleAIAddAndSubmit, handleAISubmitWithout,
    handleApprove, handleReject, handleAddAllToNew, handleCleanNames,
  }
}
