// app/(dashboard)/sales/types.ts
import { Sale, SaleItem, DeliveryProduct, PaymentMethod, IntegrationType } from '@/src/types/database'

export type { Sale, SaleItem, PaymentMethod }

export interface CartItem {
  product_id: string | null
  product_name: string
  category: string | null
  unit: string | null
  unit_price: number
  quantity: number
  total_price: number
}

export interface SaleProduct extends Pick<DeliveryProduct, 'id' | 'name' | 'category' | 'unit' | 'selling_price' | 'barcode' | 'order_count'> {}

// New unified cart item for redesigned POS
export interface UnifiedCartItem {
  type: 'product' | 'service'
  id: string
  name: string
  category: string
  unit_price: number
  quantity: number
  total_price: number
  // product-only:
  unit?: string
  // service-only:
  integration_type?: IntegrationType
  starts_at?: string
  ends_at?: string
}

export type SalesTab = 'pos' | 'services' | 'new' | 'history' | 'report' | 'open_tabs' | 'catalog'
