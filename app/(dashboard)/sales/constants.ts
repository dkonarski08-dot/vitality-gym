import type { DiscountTier } from '@/src/types/database'

export const DISCOUNT_BY_TIER: Record<DiscountTier, number> = {
  none: 0,
  standard: 5,
  vip: 10,
}

export const DISCOUNT_TIER_LABELS: Record<DiscountTier, string> = {
  none: 'Без отстъпка',
  standard: 'Стандартна (5%)',
  vip: 'VIP (10%)',
}
