// app/(dashboard)/requests/types.ts

export interface Product {
  id: string
  name: string
  category: string
  unit: string
  last_price: number | null
  order_count: number
}

export interface RequestItem {
  product_id: string | null
  product_name: string
  quantity: number
  unit: string
  note: string | null
}

export interface DeliveryRequest {
  id: string
  month: string
  status: string
  created_by: string
  notes: string | null
  ai_suggestions: string | null
  created_at: string
  delivery_request_items: (RequestItem & { id: string })[]
}
