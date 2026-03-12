// app/(dashboard)/requests/types.ts

export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface DeliveryProduct {
  id: string
  name: string
  clean_name: string | null
  category: string
  unit: string
  last_price: number | null
  order_count: number
}

export interface SupplierProduct {
  product_name: string
  unit: string
  clean_name: string | null  // matched from delivery_products
}

export interface DraftItem {
  product_id: string | null
  product_name: string        // resolved: clean_name ?? name at add-time
  quantity: number            // integer, min 1
  unit: string
  note: string | null
}

export interface SavedDraftItem extends DraftItem {
  id: string
}

export interface DeliveryRequest {
  id: string
  month: string               // YYYY-MM
  status: RequestStatus
  created_by: string
  approved_by: string | null
  notes: string | null
  ai_suggestions: string | null
  created_at: string
  delivery_request_items: SavedDraftItem[]
}

export interface Supplier {
  supplier_name: string
  product_count: number
}

export interface AISuggestion {
  prose: string
  suggestions: { name: string; unit: string }[]
}
