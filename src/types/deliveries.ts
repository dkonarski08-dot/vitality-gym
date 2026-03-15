// src/types/deliveries.ts

/** Single product line within a delivery invoice */
export interface DeliveryItem {
  id?: string
  product_name: string
  product_code: string | null
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  expiry_date: string | null
  category: string
  uncertain?: boolean
}

/** Full delivery record as returned by /api/deliveries */
export interface Delivery {
  id: string
  supplier_name: string
  invoice_number: string | null
  invoice_date: string | null
  payment_due_date: string | null
  payment_method: string | null
  subtotal: number | null
  vat_amount: number | null
  total_amount: number | null
  photo_url: string | null
  extra_photos: string[] | null
  ai_parsed: boolean
  ai_confidence: string | null
  staff_name: string
  notes: string | null
  /** 'pending' | 'approved' | 'rejected' */
  status: string
  created_at: string
  delivery_items: DeliveryItem[]
}

/** Supplier record — full record from suppliers table */
export interface Supplier {
  id: string
  gym_id: string
  name: string
  eik: string | null
  product_types: string | null
  website: string | null
  address: string | null
  payment_terms: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  active: boolean
  total_deliveries: number
  total_amount: number
  last_delivery_at: string | null
  created_at: string
}

/** DeliveryItem enriched with delivery context for the expiry tab */
export interface ExpiringItem extends DeliveryItem {
  /** Supplier who delivered this item */
  supplier: string
}

/** Consolidated form state for the edit delivery modal (Fix 2) */
export interface EditFormState {
  id: string
  supplier: string
  invoiceNumber: string
  invoiceDate: string
  paymentDueDate: string
  paymentMethod: string
  totalAmount: string
  notes: string
  items: DeliveryItem[]
}

/** Available units for delivery item quantities */
export const UNITS = ['бр', 'кг', 'стек', 'л', 'кутия', 'пакет'] as const
export type Unit = typeof UNITS[number]

/** Blank item — used when adding a new line in any form */
export const EMPTY_ITEM: DeliveryItem = {
  product_name: '',
  product_code: null,
  quantity: 1,
  unit: 'бр',
  unit_price: null,
  total_price: null,
  expiry_date: null,
  category: 'Други',
}

/** Default value for EditFormState — reset when closing the modal */
export const EMPTY_EDIT_FORM: EditFormState = {
  id: '',
  supplier: '',
  invoiceNumber: '',
  invoiceDate: '',
  paymentDueDate: '',
  paymentMethod: 'cash',
  totalAmount: '',
  notes: '',
  items: [],
}
