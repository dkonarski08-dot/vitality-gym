-- migrations/010_schema_cleanup.sql
-- Drop dead pin_code column (moved to app_users.pin_hash in 005_app_users).
-- Add gym_id to employees and shifts for multi-tenancy filtering.

-- Drop pin_code if it exists
ALTER TABLE employees DROP COLUMN IF EXISTS pin_code;

-- Add gym_id with default so all existing rows get assigned to the one gym
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS gym_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS gym_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';

CREATE INDEX IF NOT EXISTS idx_employees_gym_id ON employees(gym_id);
CREATE INDEX IF NOT EXISTS idx_shifts_gym_id    ON shifts(gym_id);
