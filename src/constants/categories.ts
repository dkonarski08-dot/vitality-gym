/**
 * Shared delivery product categories.
 * Single source of truth — import from here instead of redefining.
 */
export const PRODUCT_CATEGORIES = [
  'Протеини',
  'Протеинови барчета',
  'Протеин на дози',
  'BCAA',
  'Буустери',
  'Wellness / Витамини',
  'Енергийни напитки',
  'Витаминова вода',
  'Вода',
  'Кафе',
  'Спортни напитки',
  'Почистващи',
  'Консумативи',
  'Други',
] as const

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]
