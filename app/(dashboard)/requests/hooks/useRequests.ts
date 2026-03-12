// app/(dashboard)/requests/hooks/useRequests.ts
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from '@/hooks/useSession'
import { DeliveryProduct, DraftItem, DeliveryRequest } from '../types'

export function useRequests() {
  const { userRole, userName } = useSession()
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [topProducts, setTopProducts] = useState<DeliveryProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Search
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Current draft
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // View history
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [reqRes, topRes] = await Promise.all([
      fetch('/api/requests'), fetch('/api/requests?type=top'),
    ])
    const [reqData, topData] = await Promise.all([reqRes.json(), topRes.json()])
    setRequests(reqData.requests || [])
    setTopProducts(topData.products || [])

    const draft = (reqData.requests || []).find((r: DeliveryRequest) => r.status === 'draft')
    if (draft) {
      setDraftId(draft.id)
      setDraftItems(draft.delivery_request_items.map((i: RequestItem & { id: string }) => ({
        product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit: i.unit, note: i.note,
      })))
      setDraftNotes(draft.notes || '')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Autocomplete search with debounce
  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/requests?type=search&q=${encodeURIComponent(search)}`)
      const data = await res.json()
      setSuggestions(data.products || [])
      setShowSuggestions(true)
      setSearching(false)
    }, 200)
  }, [search])

  const addProduct = useCallback((product: DeliveryProduct | { name: string; unit: string; id?: string }) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.product_name === product.name)
      if (existing) {
        return prev.map(i => i.product_name === product.name ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        product_id: ('id' in product && product.id) ? product.id : null,
        product_name: product.name,
        quantity: 1,
        unit: product.unit || 'бр',
        note: null,
      }]
    })
    setSearch('')
    setSuggestions([])
    setShowSuggestions(false)
    searchRef.current?.focus()
  }, [])

  const addMultipleProducts = useCallback((items: { product_name: string; unit: string; product_id: string | null }[]) => {
    setDraftItems(prev => {
      let updated = [...prev]
      for (const item of items) {
        const existing = updated.find(i => i.product_name === item.product_name)
        if (existing) {
          updated = updated.map(i => i.product_name === item.product_name ? { ...i, quantity: i.quantity + 1 } : i)
        } else {
          updated.push({ product_id: item.product_id, product_name: item.product_name, quantity: 1, unit: item.unit || 'бр', note: null })
        }
      }
      return updated
    })
  }, [])

  const addCustomProduct = useCallback(() => {
    if (!search.trim()) return
    addProduct({ name: search.trim(), unit: 'бр' })
  }, [search, addProduct])

  const updateQty = useCallback((idx: number, qty: number) => {
    if (qty <= 0) { setDraftItems(prev => prev.filter((_, i) => i !== idx)); return }
    setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
  }, [])

  const removeItem = useCallback((idx: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleSave = useCallback(async () => {
    if (draftItems.length === 0) return
    setSaving(true)
    if (draftId) {
      await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: draftId, notes: draftNotes, items: draftItems }),
      })
    } else {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', created_by: userName, notes: draftNotes, items: draftItems }),
      })
      const data = await res.json()
      if (data.request) setDraftId(data.request.id)
    }
    setSaving(false)
  }, [draftItems, draftId, draftNotes, userName])

  const handleSubmit = useCallback(async () => {
    if (draftItems.length === 0) return
    setSubmitting(true)
    await handleSave()
    if (draftId) {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id: draftId }),
      })
      const data = await res.json()
      if (data.ai_suggestions) setAiSuggestion(data.ai_suggestions)
      setDraftId(null); setDraftItems([]); setDraftNotes('')
      await loadData()
    }
    setSubmitting(false)
  }, [draftItems, draftId, handleSave, loadData])

  const handleDelete = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    if (draftId === id) { setDraftId(null); setDraftItems([]); setDraftNotes('') }
    await loadData()
  }, [draftId, loadData])

  const handleApprove = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id }),
    })
    await loadData()
  }, [loadData])

  const handleReject = useCallback(async (id: string) => {
    await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', id }),
    })
    await loadData()
  }, [loadData])

  const handleCleanup = useCallback(async () => {
    setCleaning(true); setCleanResult(null)
    const res = await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cleanup_names' }),
    })
    const data = await res.json()
    setCleanResult(data.cleaned > 0 ? `✓ Коригирани ${data.cleaned} имена` : '✓ Всички имена са правилни')
    if (data.cleaned > 0) await loadData()
    setCleaning(false)
    setTimeout(() => setCleanResult(null), 4000)
  }, [loadData])

  const filteredTop = useMemo(() =>
    selectedCategory === 'all' ? topProducts : topProducts.filter(p => p.category === selectedCategory),
  [selectedCategory, topProducts])

  const availableCategories = useMemo(() =>
    [...new Set(topProducts.map(p => p.category).filter(Boolean))],
  [topProducts])

  const pastRequests = useMemo(() =>
    requests.filter(r => r.status !== 'draft'),
  [requests])

  return {
    userRole, loading,
    // search
    search, setSearch, suggestions, showSuggestions, setShowSuggestions, searching, searchRef,
    // draft
    draftItems, draftNotes, setDraftNotes, draftId, saving, submitting, aiSuggestion, setAiSuggestion,
    // category
    selectedCategory, setSelectedCategory,
    // history
    selectedRequest, setSelectedRequest,
    // admin
    cleaning, cleanResult,
    // derived
    filteredTop, availableCategories, pastRequests,
    // handlers
    addProduct, addMultipleProducts, addCustomProduct,
    updateQty, removeItem,
    handleSave, handleSubmit, handleDelete, handleCleanup, handleApprove, handleReject,
  }
}
