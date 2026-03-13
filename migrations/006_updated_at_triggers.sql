-- migrations/006_updated_at_triggers.sql
-- Auto-maintain updated_at on every UPDATE so direct SQL edits stay consistent.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- app_users
DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- employees
DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- shifts
DROP TRIGGER IF EXISTS trg_shifts_updated_at ON shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- pt_clients
DROP TRIGGER IF EXISTS trg_pt_clients_updated_at ON pt_clients;
CREATE TRIGGER trg_pt_clients_updated_at
  BEFORE UPDATE ON pt_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- pt_packages
DROP TRIGGER IF EXISTS trg_pt_packages_updated_at ON pt_packages;
CREATE TRIGGER trg_pt_packages_updated_at
  BEFORE UPDATE ON pt_packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- pt_sessions
DROP TRIGGER IF EXISTS trg_pt_sessions_updated_at ON pt_sessions;
CREATE TRIGGER trg_pt_sessions_updated_at
  BEFORE UPDATE ON pt_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
