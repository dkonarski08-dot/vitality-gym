-- migrations/015_clients_services.sql
-- Adds: clients, service_types, client_memberships, service_records, open_tabs
-- Extends: sales with business_unit, client_id, discount_amount, open_tab_id
-- Note: gym_id is not FK-constrained (consistent with rest of codebase)

-- 1. clients — canonical shared table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  discount_tier text NOT NULL DEFAULT 'none'
    CHECK (discount_tier IN ('none', 'standard', 'vip')),
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_clients_gym ON clients(gym_id);
CREATE INDEX idx_clients_phone ON clients(gym_id, phone);
CREATE INDEX idx_clients_name ON clients(gym_id, name);

-- 2. service_types — admin-managed sellable services
CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  name text NOT NULL,
  price decimal(10,2) NOT NULL,
  category text NOT NULL,
  business_unit text NOT NULL DEFAULT 'gym'
    CHECK (business_unit IN ('gym', 'hall')),
  integration_type text NOT NULL DEFAULT 'service_record'
    CHECK (integration_type IN ('membership', 'pt_package', 'pt_single', 'service_record', 'hall_entry')),
  duration_days int,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_service_types_gym ON service_types(gym_id, active);

-- 3. client_memberships — active gym memberships per client
CREATE TABLE client_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id),
  service_type_id uuid REFERENCES service_types(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_client_memberships_client ON client_memberships(client_id, status);
CREATE INDEX idx_client_memberships_gym ON client_memberships(gym_id, status);

-- 4. open_tabs — unpaid bills (NOT in sales until paid)
CREATE TABLE open_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  business_unit text NOT NULL DEFAULT 'gym'
    CHECK (business_unit IN ('gym', 'hall')),
  client_id uuid REFERENCES clients(id),
  has_services boolean NOT NULL DEFAULT false,
  items jsonb NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  discount_amount decimal(10,2) NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT service_tab_requires_client
    CHECK (has_services = false OR client_id IS NOT NULL)
);
CREATE INDEX idx_open_tabs_gym ON open_tabs(gym_id, created_at DESC);

-- 5. service_records — created ONLY when sale is finalized
CREATE TABLE service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id),
  service_type_id uuid REFERENCES service_types(id),
  sale_id uuid REFERENCES sales(id),
  starts_at date,
  ends_at date,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_service_records_client ON service_records(client_id);
CREATE INDEX idx_service_records_sale ON service_records(sale_id);

-- 6. Extend sales table
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS business_unit text NOT NULL DEFAULT 'gym'
    CHECK (business_unit IN ('gym', 'hall')),
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_tab_id uuid REFERENCES open_tabs(id);

-- 7. Seed default service types for Vitality Gym
INSERT INTO service_types (gym_id, name, price, category, business_unit, integration_type, duration_days) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Месечна карта фитнес', 50.00, 'Абонаменти', 'gym', 'membership', 30),
  ('00000000-0000-0000-0000-000000000001', 'Тримесечна карта', 130.00, 'Абонаменти', 'gym', 'membership', 90),
  ('00000000-0000-0000-0000-000000000001', 'Годишна карта', 480.00, 'Абонаменти', 'gym', 'membership', 365),
  ('00000000-0000-0000-0000-000000000001', 'Еднократна тренировка фитнес', 8.00, 'Еднократни', 'gym', 'service_record', null),
  ('00000000-0000-0000-0000-000000000001', 'Зумба / Пилатес / Групова', 6.00, 'Еднократни', 'gym', 'service_record', null),
  ('00000000-0000-0000-0000-000000000001', 'PT пакет 10 сесии', 200.00, 'PT пакети', 'gym', 'pt_package', null),
  ('00000000-0000-0000-0000-000000000001', 'Еднократна тренировка с инструктор', 25.00, 'PT пакети', 'gym', 'pt_single', null),
  ('00000000-0000-0000-0000-000000000001', 'Терабоди ботуши', 15.00, 'Wellness', 'gym', 'service_record', null),
  ('00000000-0000-0000-0000-000000000001', 'Наем шкаф (месец)', 10.00, 'Наеми', 'gym', 'service_record', 30),
  ('00000000-0000-0000-0000-000000000001', 'Наем кърпа', 2.00, 'Наеми', 'gym', 'service_record', null),
  ('00000000-0000-0000-0000-000000000001', 'Hall наем за събитие', 150.00, 'Hall наем', 'hall', 'service_record', null);
