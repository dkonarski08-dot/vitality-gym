-- migrations/004_pt_client_package_fields.sql
-- Add preferred scheduling fields to pt_clients
ALTER TABLE pt_clients 
  ADD COLUMN IF NOT EXISTS preferred_days text[],        -- e.g. ['monday','wednesday','friday']
  ADD COLUMN IF NOT EXISTS preferred_time_slot text;     -- 'morning' | 'afternoon' | 'evening'

-- Add starts_on and duration_months to pt_packages (replaces expires_at logic)
ALTER TABLE pt_packages
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS duration_months integer;      -- e.g. 1, 2, 3 months
