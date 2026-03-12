-- Migration: add_supplier_fields
-- Adds extended fields to the suppliers table

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS eik text,
  ADD COLUMN IF NOT EXISTS product_types text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS total_deliveries int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_at timestamptz;
