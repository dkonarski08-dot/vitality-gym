// app/(dashboard)/deliveries/hooks/useSuppliers.ts
import { useState, useEffect, useCallback } from 'react'
import type { Supplier } from '@/src/types/deliveries'

export interface SupplierFormData {
  name: string
  eik: string
  product_types: string
  website: string
  address: string
  payment_terms: string
  contact_person: string
  phone: string
  email: string
  notes: string
}

export const EMPTY_SUPPLIER_FORM: SupplierFormData = {
  name: '',
  eik: '',
  product_types: '',
  website: '',
  address: '',
  payment_terms: '',
  contact_person: '',
  phone: '',
  email: '',
  notes: '',
}

export interface SuppliersHookReturn {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
  saving: boolean
  fetchSuppliers: () => Promise<void>
  createSupplier: (data: SupplierFormData) => Promise<boolean>
  updateSupplier: (id: string, data: Partial<SupplierFormData> & { active?: boolean }) => Promise<boolean>
  deleteSupplier: (id: string) => Promise<boolean>
}

export function useSuppliers(): SuppliersHookReturn {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Грешка при зареждане')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const createSupplier = async (formData: SupplierFormData): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Грешка при запазване')
      }
      await fetchSuppliers()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateSupplier = async (
    id: string,
    data: Partial<SupplierFormData> & { active?: boolean }
  ): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Грешка при обновяване')
      }
      await fetchSuppliers()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
      return false
    } finally {
      setSaving(false)
    }
  }

  const deleteSupplier = async (id: string): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Грешка при деактивиране')
      }
      await fetchSuppliers()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
      return false
    } finally {
      setSaving(false)
    }
  }

  return { suppliers, loading, error, saving, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier }
}
