-- Migration 012: Indexes and CHECK constraints for PT module
-- FK indexes missing from 003
CREATE INDEX IF NOT EXISTS idx_pt_packages_instructor ON pt_packages(instructor_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_package ON pt_sessions(package_id);
CREATE INDEX IF NOT EXISTS idx_pt_recurrence_client ON pt_recurrence_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);

-- Filtered indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pt_sessions_status ON pt_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pt_packages_expires_at ON pt_packages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_packages_active ON pt_packages(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_pt_clients_active ON pt_clients(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON app_users(is_active) WHERE is_active = true;

-- CHECK constraints (only apply if pre-flight checks passed)
ALTER TABLE pt_sessions ADD CONSTRAINT chk_session_price_non_negative
  CHECK (session_price IS NULL OR session_price >= 0);
ALTER TABLE pt_packages ADD CONSTRAINT chk_total_sessions_positive
  CHECK (total_sessions > 0);
ALTER TABLE pt_sessions ADD CONSTRAINT chk_session_duration_positive
  CHECK (duration_minutes > 0);
ALTER TABLE pt_packages ADD CONSTRAINT chk_used_sessions_range
  CHECK (used_sessions >= 0 AND used_sessions <= total_sessions);

-- Expand audit triggers (audit_trigger_fn() exists from migration 008)
DROP TRIGGER IF EXISTS trg_audit_shifts ON shifts;
DROP TRIGGER IF EXISTS trg_audit_pt_clients ON pt_clients;
DROP TRIGGER IF EXISTS trg_audit_pt_inquiries ON pt_inquiries;

CREATE TRIGGER trg_audit_shifts
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER trg_audit_pt_clients
  AFTER INSERT OR UPDATE OR DELETE ON pt_clients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER trg_audit_pt_inquiries
  AFTER INSERT OR UPDATE OR DELETE ON pt_inquiries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
