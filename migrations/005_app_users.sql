-- migrations/005_app_users.sql
-- Login accounts table — separate from employees (HR/payroll)
-- NOTE: Does NOT nullify employees.pin_code — run seed first, then 005b

CREATE TABLE IF NOT EXISTS app_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('admin', 'receptionist', 'instructor')),
  pin_hash     text NOT NULL,
  employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
  phone        text,
  birth_date   date,
  hired_at     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);

CREATE INDEX IF NOT EXISTS idx_app_users_gym_id ON app_users(gym_id);
CREATE INDEX IF NOT EXISTS idx_app_users_employee_id ON app_users(employee_id);
