-- migrations/003_pt_calendar.sql
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pt_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  instructor_id uuid NOT NULL REFERENCES employees(id),
  name text NOT NULL,
  phone text,
  email text,
  goal text,
  health_notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pt_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  client_id uuid NOT NULL REFERENCES pt_clients(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES employees(id),
  total_sessions integer NOT NULL,
  used_sessions integer NOT NULL DEFAULT 0,
  price_total numeric(10,2),
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  instructor_id uuid NOT NULL REFERENCES employees(id),
  client_id uuid NOT NULL REFERENCES pt_clients(id),
  package_id uuid REFERENCES pt_packages(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  session_type text NOT NULL DEFAULT 'personal',
  status text NOT NULL DEFAULT 'scheduled',
  location text,
  notes text,
  cancelled_at timestamptz,
  cancelled_by text,
  recurrence_group_id uuid,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pt_recurrence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  instructor_id uuid NOT NULL REFERENCES employees(id),
  client_id uuid NOT NULL REFERENCES pt_clients(id),
  package_id uuid REFERENCES pt_packages(id),
  day_of_week integer NOT NULL,
  time_of_day time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  session_type text NOT NULL DEFAULT 'personal',
  location text,
  active boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_sessions_instructor ON pt_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_client ON pt_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_scheduled ON pt_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pt_clients_instructor ON pt_clients(instructor_id);
CREATE INDEX IF NOT EXISTS idx_pt_packages_client ON pt_packages(client_id);
