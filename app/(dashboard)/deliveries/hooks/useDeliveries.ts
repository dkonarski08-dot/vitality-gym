// app/(dashboard)/deliveries/hooks/useDeliveries.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from '@/hooks/useSession'
import type { Delivery, DeliveryItem, Supplier, ExpiringItem, EditFormState } from '@/src/types/deliveries'
import { EMPTY_ITEM, EMPTY_EDIT_FORM } from '@/src/types/deliveries'

// ── Utilities ─────────────────────────────────────────────────────────────────

function compressImage(base64: string, maxWidth = 1200, quality = 0.6): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.src = `data:image/jpeg;base64,${base64}`
  })
}

function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/\d+\s*г\b|\d+\s*кг\b|\d+\s*мл\b|\d+\s*л\b/g, '').trim()
}

function dateShort(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DeliveryProduct {
  name: string
  last_price: number | null
  category: string
  unit: string
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface DeliveriesHookReturn {
  // Session
  userRole: string
  userName: string
  // Core data
  deliveries: Delivery[]
  suppliers: Supplier[]
  deliveryProducts: DeliveryProduct[]
  loading: boolean
  loadData: () => Promise<void>
  // Computed — Fix 3 (expiringItems), Fix 4 (sortedMonths)
  filteredDeliveries: Delivery[]
  expiringItems: ExpiringItem[]
  sortedMonths: string[]
  // Insights computed
  insightDeliveries: Delivery[]
  supplierBreakdown: [string, { count: number; total: number }][]
  categoryBreakdown: [string, { count: number; total: number }][]
  maxCat: number
  productFrequency: [string, { count: number; totalQty: number; totalSpend: number }][]
  // Upload form state
  photoPreview: string | null
  photoBase64: string | null
  extraPhotos: { preview: string; base64: string }[]
  parsing: boolean
  parseError: string | null
  saving: boolean
  dragging: boolean
  supplierName: string
  invoiceNumber: string
  invoiceDate: string
  paymentDue: string
  paymentMethod: string
  totalAmount: string
  formNotes: string
  items: DeliveryItem[]
  aiConfidence: string | null
  aiWarnings: string[]
  aiParsed: boolean
  formReady: boolean
  // AI suggestions (display-only — never auto-filled into fields)
  aiSuggestedAmount: string
  aiDetectedProducts: string[]
  // Upload actions — Fix 5 (processFile receives File, refs stay in component)
  processFile: (file: File, isExtra?: boolean) => void
  handleParse: () => Promise<void>
  handleSave: () => Promise<boolean>
  resetForm: () => void
  // Duplicate detection
  pendingDuplicate: { existing: { id: string; name: string; eik: string | null }; fromInvoice: { name: string; eik: string | null } } | null
  confirmUseExisting: () => Promise<void>
  confirmCreateNew: () => Promise<void>
  dismissDuplicate: () => void
  addItem: () => void
  addItemWithName: (name: string) => void
  updateItem: <K extends keyof DeliveryItem>(idx: number, field: K, value: DeliveryItem[K]) => void
  removeItem: (idx: number) => void
  hasErrors: () => boolean
  setDragging: (v: boolean) => void
  setPhotoPreview: (v: string | null) => void
  setPhotoBase64: (v: string | null) => void
  removeExtraPhoto: (idx: number) => void
  setSupplierName: (v: string) => void
  setInvoiceNumber: (v: string) => void
  setInvoiceDate: (v: string) => void
  setPaymentDue: (v: string) => void
  setPaymentMethod: (v: string) => void
  setTotalAmount: (v: string) => void
  setFormNotes: (v: string) => void
  setFormReady: (v: boolean) => void
  // History state
  historyMonth: string
  selectedId: string | null
  confirmDelete: string | null
  editForm: EditFormState          // Fix 2
  isEditModalOpen: boolean         // Fix 2
  editSaving: boolean
  actionLoading: string | null     // Fix 6
  copiedLink: string | null
  // History actions
  setHistoryMonth: (v: string) => void
  setSelectedId: (v: string | null) => void
  setConfirmDelete: (v: string | null) => void
  handleDelete: (id: string) => Promise<void>
  handleApprove: (id: string) => Promise<void>  // Fix 1
  handleReject: (id: string) => Promise<void>   // Fix 1
  openEditModal: (delivery: Delivery) => void   // Fix 2
  closeEditModal: () => void                    // Fix 2
  updateEditField: <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => void // Fix 2
  updateEditItem: <K extends keyof DeliveryItem>(idx: number, field: K, value: DeliveryItem[K]) => void
  removeEditItem: (idx: number) => void
  addEditItem: () => void
  handleEditSave: () => Promise<void>
  exportCSV: () => void
  copyLink: (url: string) => void
  copyMonthLinks: () => void
  // Insights state
  insightCategory: string
  insightFrom: string
  insightTo: string
  setInsightCategory: (v: string) => void
  setInsightFrom: (v: string) => void
  setInsightTo: (v: string) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDeliveries(): DeliveriesHookReturn {
  const { userRole, userName } = useSession()

  // Core data
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [deliveryProducts, setDeliveryProducts] = useState<DeliveryProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Upload form
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [extraPhotos, setExtraPhotos] = useState<{ preview: string; base64: string }[]>([])
  const [photoMime, setPhotoMime] = useState('image/jpeg')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [paymentDue, setPaymentDue] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [items, setItems] = useState<DeliveryItem[]>([])
  const [aiConfidence, setAiConfidence] = useState<string | null>(null)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [aiParsed, setAiParsed] = useState(false)
  const [formReady, setFormReady] = useState(false)
  // AI suggestions — displayed as hints, never auto-filled
  const [aiSuggestedAmount, setAiSuggestedAmount] = useState('')
  const [aiDetectedProducts, setAiDetectedProducts] = useState<string[]>([])
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    existing: { id: string; name: string; eik: string | null }
    fromInvoice: { name: string; eik: string | null }
    pendingPayload: Record<string, unknown>
  } | null>(null)

  // History
  const [historyMonth, setHistoryMonth] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // Fix 6
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Insights filters
  const [insightCategory, setInsightCategory] = useState('all')
  const [insightFrom, setInsightFrom] = useState('')
  const [insightTo, setInsightTo] = useState('')

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s, p] = await Promise.all([
        fetch('/api/deliveries'),
        fetch('/api/deliveries?type=suppliers'),
        fetch('/api/deliveries?type=products'),
      ])
      const [dd, sd, pd] = await Promise.all([d.json(), s.json(), p.json()])
      setDeliveries(dd.deliveries || [])
      setSuppliers(sd.suppliers || [])
      setDeliveryProducts(pd.products || [])
    } catch (err) {
      console.error('Failed to load deliveries:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Computed — Fix 3, Fix 4 ─────────────────────────────────────────────────

  // Fix 4: sortedMonths shared between History and Insights
  const sortedMonths = useMemo(() => {
    const months = new Set(deliveries.map(d => d.invoice_date?.slice(0, 7)).filter(Boolean))
    return Array.from(months).sort((a, b) => b!.localeCompare(a!)) as string[]
  }, [deliveries])

  const filteredDeliveries = useMemo(
    () => historyMonth
      ? deliveries.filter(d => d.invoice_date?.startsWith(historyMonth))
      : deliveries,
    [deliveries, historyMonth]
  )

  // Fix 3: expiringItems as useMemo — purely derived, no state
  const expiringItems = useMemo<ExpiringItem[]>(() => {
    const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    return deliveries
      .filter(d => d.status === 'approved')
      .flatMap(d =>
        (d.delivery_items || []).map(item => ({ ...item, supplier: d.supplier_name }))
      )
      .filter(item => {
        if (!item.expiry_date) return false
        return new Date(item.expiry_date) <= in90Days
      })
      .sort((a, b) =>
        new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime()
      )
  }, [deliveries])

  // Insights
  const insightDeliveries = useMemo(() => {
    return deliveries
      .filter(d => d.status === 'approved')
      .filter(d => {
        if (!d.invoice_date) return true
        if (insightFrom && d.invoice_date < insightFrom + '-01') return false
        if (insightTo) {
          const [y, m] = insightTo.split('-').map(Number)
          if (d.invoice_date > `${insightTo}-${new Date(y, m, 0).getDate()}`) return false
        }
        return true
      })
  }, [deliveries, insightFrom, insightTo])

  const allInsightItems = useMemo(
    () => insightDeliveries.flatMap(d =>
      (d.delivery_items || []).map(i => ({ ...i, supplier: d.supplier_name }))
    ),
    [insightDeliveries]
  )

  const filteredInsightItems = useMemo(
    () => insightCategory === 'all'
      ? allInsightItems
      : allInsightItems.filter(i => i.category === insightCategory),
    [allInsightItems, insightCategory]
  )

  const supplierBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    insightDeliveries.forEach(d => {
      if (!map[d.supplier_name]) map[d.supplier_name] = { count: 0, total: 0 }
      map[d.supplier_name].count++
      map[d.supplier_name].total += d.total_amount || 0
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total) as [string, { count: number; total: number }][]
  }, [insightDeliveries])

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    allInsightItems.forEach(i => {
      const c = i.category || 'Други'
      if (!map[c]) map[c] = { count: 0, total: 0 }
      map[c].count += i.quantity
      map[c].total += i.total_price || (i.unit_price || 0) * i.quantity
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total) as [string, { count: number; total: number }][]
  }, [allInsightItems])

  const maxCat = useMemo(
    () => Math.max(...categoryBreakdown.map(([, d]) => d.total), 1),
    [categoryBreakdown]
  )

  const productFrequency = useMemo(() => {
    const map: Record<string, { count: number; totalQty: number; totalSpend: number }> = {}
    filteredInsightItems.forEach(i => {
      const n = normalizeProductName(i.product_name)
      if (!map[n]) map[n] = { count: 0, totalQty: 0, totalSpend: 0 }
      map[n].count++
      map[n].totalQty += i.quantity
      map[n].totalSpend += i.total_price || (i.unit_price || 0) * i.quantity
    })
    return Object.entries(map).sort((a, b) => b[1].totalSpend - a[1].totalSpend) as [string, { count: number; totalQty: number; totalSpend: number }][]
  }, [filteredInsightItems])

  // ── File processing — Fix 5 (receives File, refs stay in component) ─────────

  const processFile = (file: File, isExtra = false) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return
    const isPdf = file.type === 'application/pdf'
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result as string
      const rawBase64 = result.split(',')[1]
      const finalBase64 = isPdf ? rawBase64 : await compressImage(rawBase64)
      const mime = isPdf ? 'application/pdf' : 'image/jpeg'
      if (isExtra) {
        setExtraPhotos(prev => [...prev, { preview: isPdf ? '📄 PDF' : result, base64: finalBase64 }])
      } else {
        setPhotoPreview(isPdf ? '📄 PDF файл: ' + file.name : result)
        setPhotoBase64(finalBase64)
        setPhotoMime(mime)
        setFormReady(false)
        setParseError(null)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Upload handlers ──────────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!photoBase64) return
    setParsing(true); setParseError(null)
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', image_base64: photoBase64, mime_type: photoMime }),
      })
      const data = await res.json()
      const p = data.parsed || {}

      // Auto-fill header fields from AI
      setSupplierName(p.supplier_name || '')
      setInvoiceNumber(p.invoice_number || '')
      setInvoiceDate(p.invoice_date || '')
      setPaymentDue(p.payment_due_date || '')
      setPaymentMethod(p.payment_method || '')

      // Total amount: store as AI suggestion only — user must enter manually
      setAiSuggestedAmount(p.total_amount ? String(p.total_amount) : '')
      // Total amount field stays empty for manual entry
      setTotalAmount('')

      // Notes: leave empty — user fills manually
      setFormNotes('')

      setAiConfidence(p.confidence || 'low')
      setAiWarnings(p.validation?.warnings || [])
      setAiParsed(true)

      // Products: store names for the collapsible suggestions panel
      // Do NOT auto-populate the table rows
      if (p.items?.length > 0) {
        const names = (p.items as Record<string, unknown>[])
          .map(i => (i.product_name as string) || '')
          .filter(Boolean)
        setAiDetectedProducts(names)
      } else {
        setAiDetectedProducts([])
      }
      // Always start with one empty row
      setItems([{ ...EMPTY_ITEM }])

      setFormReady(true)
    } catch {
      setFormReady(true)
      setItems([{ ...EMPTY_ITEM }])
      setAiDetectedProducts([])
      setAiSuggestedAmount('')
      setParseError('Грешка — попълни ръчно')
    }
    setParsing(false)
  }

  const uploadPhoto = async (b64: string): Promise<string | null> => {
    const res = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_photo',
        image_base64: b64,
        mime_type: 'image/jpeg',
        filename: invoiceNumber || 'invoice',
      }),
    })
    return (await res.json()).url || null
  }

  const buildSavePayload = (
    photoUrl: string | null,
    extraUrls: string[],
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    action: 'save',
    supplier_name: supplierName,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    payment_due_date: paymentDue,
    payment_method: paymentMethod,
    total_amount: parseFloat(totalAmount) || null,
    photo_url: photoUrl,
    extra_photos: extraUrls,
    ai_parsed: aiParsed,
    ai_confidence: aiConfidence,
    staff_name: userName,
    notes: formNotes,
    items: items.filter(i => i.product_name.trim()),
    ...overrides,
  })

  const doSave = async (payload: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.needs_confirmation) {
      setPendingDuplicate({
        existing: data.potential_duplicate,
        fromInvoice: data.from_invoice,
        pendingPayload: payload,
      })
      return false
    }
    resetForm()
    await loadData()
    return true
  }

  const handleSave = async (): Promise<boolean> => {
    if (!supplierName.trim() || !totalAmount.trim() || hasErrors()) return false
    setSaving(true)
    try {
      const photoUrl = photoBase64 ? await uploadPhoto(photoBase64) : null
      const extraUrls: string[] = []
      for (const ep of extraPhotos) {
        const u = await uploadPhoto(ep.base64)
        if (u) extraUrls.push(u)
      }
      return await doSave(buildSavePayload(photoUrl, extraUrls))
    } catch (err) {
      console.error('Save failed:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  const confirmUseExisting = async () => {
    if (!pendingDuplicate) return
    setSaving(true)
    try {
      await doSave({ ...pendingDuplicate.pendingPayload, supplier_id: pendingDuplicate.existing.id })
    } finally {
      setPendingDuplicate(null)
      setSaving(false)
    }
  }

  const confirmCreateNew = async () => {
    if (!pendingDuplicate) return
    setSaving(true)
    try {
      await doSave({ ...pendingDuplicate.pendingPayload, force_new: true })
    } finally {
      setPendingDuplicate(null)
      setSaving(false)
    }
  }

  const dismissDuplicate = () => setPendingDuplicate(null)

  const resetForm = () => {
    setPhotoPreview(null); setPhotoBase64(null); setExtraPhotos([])
    setSupplierName(''); setInvoiceNumber(''); setInvoiceDate('')
    setPaymentDue(''); setPaymentMethod(''); setTotalAmount('')
    setFormNotes(''); setItems([]); setAiConfidence(null)
    setAiWarnings([]); setAiParsed(false); setFormReady(false); setParseError(null)
    setAiSuggestedAmount(''); setAiDetectedProducts([])
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const addItemWithName = (name: string) => setItems(prev => [...prev, { ...EMPTY_ITEM, product_name: name }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = <K extends keyof DeliveryItem>(idx: number, field: K, value: DeliveryItem[K]) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  const hasErrors = () => items.some(i => i.product_name.trim() && i.unit_price == null)

  // ── History handlers ─────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      setConfirmDelete(null); setSelectedId(null)
      await loadData()
    } catch (err) { console.error(err) }
  }

  // Fix 1: named approve/reject — no inline fetch in JSX
  // Fix 6: actionLoading tracks which delivery is in flight
  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id, approved_by: userName }),
      })
      if (!res.ok) throw new Error('Грешка при одобрение')
      await loadData()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', id, approved_by: userName }),
      })
      if (!res.ok) throw new Error('Грешка при отхвърляне')
      await loadData()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  // Fix 2: consolidated edit form state
  const openEditModal = (delivery: Delivery) => {
    setEditForm({
      id: delivery.id,
      supplier: delivery.supplier_name,
      invoiceNumber: delivery.invoice_number ?? '',
      invoiceDate: delivery.invoice_date ?? '',
      paymentDueDate: delivery.payment_due_date ?? '',
      paymentMethod: delivery.payment_method ?? 'cash',
      totalAmount: delivery.total_amount != null ? String(delivery.total_amount) : '',
      notes: delivery.notes ?? '',
      items: (delivery.delivery_items || []).map(i => ({ ...i, category: i.category || 'Други' })),
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditForm(EMPTY_EDIT_FORM)
    setIsEditModalOpen(false)
  }

  const updateEditField = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const updateEditItem = <K extends keyof DeliveryItem>(idx: number, field: K, value: DeliveryItem[K]) =>
    setEditForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }))

  const removeEditItem = (idx: number) =>
    setEditForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const addEditItem = () =>
    setEditForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))

  const handleEditSave = async () => {
    if (!editForm.id) return
    setEditSaving(true)
    try {
      await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: editForm.id,
          supplier_name: editForm.supplier,
          invoice_number: editForm.invoiceNumber,
          invoice_date: editForm.invoiceDate,
          payment_due_date: editForm.paymentDueDate,
          payment_method: editForm.paymentMethod,
          total_amount: parseFloat(editForm.totalAmount) || null,
          notes: editForm.notes,
          items: editForm.items.filter(i => i.product_name.trim()),
        }),
      })
      closeEditModal()
      await loadData()
    } catch (err) { console.error(err) }
    finally { setEditSaving(false) }
  }

  const exportCSV = () => {
    const rows = filteredDeliveries.flatMap(d =>
      (d.delivery_items || []).map(i => ({
        Доставчик: d.supplier_name,
        'Номер фактура': d.invoice_number || '',
        Дата: d.invoice_date || '',
        Продукт: i.product_name,
        Количество: i.quantity,
        Мярка: i.unit,
        'Ед. цена': i.unit_price ?? '',
        Стойност: i.total_price ?? '',
        Категория: i.category || '',
        'Годен до': i.expiry_date || '',
        Статус: d.status,
        'Обща сума': d.total_amount ?? '',
      }))
    )
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h =>
          `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`
        ).join(',')
      ),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deliveries_${historyMonth || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedLink(url)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const copyMonthLinks = () => {
    const links = filteredDeliveries
      .filter(d => d.photo_url)
      .map(d => {
        const allUrls = [d.photo_url, ...(d.extra_photos || [])]
        return `${d.supplier_name} (${dateShort(d.invoice_date)}):\n${allUrls.join('\n')}`
      })
      .join('\n\n')
    navigator.clipboard.writeText(links)
    setCopiedLink('all')
    setTimeout(() => setCopiedLink(null), 2000)
  }

  return {
    // Session
    userRole, userName,
    // Core
    deliveries, suppliers, deliveryProducts, loading, loadData,
    // Computed
    filteredDeliveries, expiringItems, sortedMonths,
    insightDeliveries, supplierBreakdown, categoryBreakdown, maxCat, productFrequency,
    // Upload state
    photoPreview, photoBase64, extraPhotos, parsing, parseError, saving, dragging,
    supplierName, invoiceNumber, invoiceDate, paymentDue, paymentMethod, totalAmount,
    formNotes, items, aiConfidence, aiWarnings, aiParsed, formReady,
    aiSuggestedAmount, aiDetectedProducts,
    // Upload actions
    processFile, handleParse, handleSave, resetForm,
    pendingDuplicate, confirmUseExisting, confirmCreateNew, dismissDuplicate,
    addItem, addItemWithName, updateItem, removeItem, hasErrors,
    setDragging, setPhotoPreview, setPhotoBase64, removeExtraPhoto: (idx: number) => setExtraPhotos(prev => prev.filter((_, i) => i !== idx)),
    setSupplierName, setInvoiceNumber, setInvoiceDate, setPaymentDue,
    setPaymentMethod, setTotalAmount, setFormNotes, setFormReady,
    // History state
    historyMonth, selectedId, confirmDelete, editForm, isEditModalOpen,
    editSaving, actionLoading, copiedLink,
    // History actions
    setHistoryMonth, setSelectedId, setConfirmDelete,
    handleDelete, handleApprove, handleReject,
    openEditModal, closeEditModal, updateEditField, updateEditItem, removeEditItem, addEditItem,
    handleEditSave, exportCSV, copyLink, copyMonthLinks,
    // Insights state
    insightCategory, insightFrom, insightTo,
    setInsightCategory, setInsightFrom, setInsightTo,
  }
}
