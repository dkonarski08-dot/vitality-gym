-- migrations/011_pt_packages_session_billing.sql

-- 1. pt_clients: add source column
ALTER TABLE pt_clients
  ADD COLUMN IF NOT EXISTS source text;

-- 2. pt_packages: add duration_days, migrate from duration_months, drop old column
ALTER TABLE pt_packages
  ADD COLUMN IF NOT EXISTS duration_days int;

-- Migrate existing data: 1 month ≈ 30 days
UPDATE pt_packages
  SET duration_days = duration_months * 30
  WHERE duration_months IS NOT NULL AND duration_days IS NULL;

ALTER TABLE pt_packages
  DROP COLUMN IF EXISTS duration_months;

-- 3. pt_sessions: add billing_type and session_price
ALTER TABLE pt_sessions
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'package',
  ADD COLUMN IF NOT EXISTS session_price numeric(10,2);

-- billing_type values: 'package' | 'individual' | 'free'
