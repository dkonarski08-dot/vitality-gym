-- Migration: Create shifts table and update employees for the new system
-- Run this in Supabase SQL Editor

-- 1. Add PIN and role columns to employees (if not exists)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_code text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_type text NOT NULL DEFAULT 'custom',  -- morning, afternoon, full, custom
  actual_start time,
  actual_end time,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- One shift per staff per day
  UNIQUE(staff_id, date)
);

-- 3. Index for fast month queries
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, date);

-- 4. View: Monthly hours summary per employee
CREATE OR REPLACE VIEW employee_monthly_hours AS
SELECT
  e.name AS employee,
  e.role,
  e.hourly_rate,
  date_trunc('month', s.date) AS month,
  COUNT(s.id) AS total_shifts,
  SUM(
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
  ) AS total_hours,
  SUM(
    CASE WHEN EXTRACT(DOW FROM s.date) IN (0, 6) THEN 1 ELSE 0 END
  ) AS weekend_shifts,
  SUM(
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
  ) * e.hourly_rate AS total_pay
FROM employees e
LEFT JOIN shifts s ON s.staff_id = e.id
WHERE e.active = true
  AND s.date IS NOT NULL
GROUP BY e.name, e.role, e.hourly_rate, date_trunc('month', s.date)
ORDER BY month DESC, e.name;

-- 5. Update existing employees with PIN codes (adjust as needed)
-- UPDATE employees SET pin_code = '1234' WHERE name = 'Dimitar';
-- UPDATE employees SET pin_code = '0000' WHERE role = 'receptionist';

-- Done! The shifts module is ready.
