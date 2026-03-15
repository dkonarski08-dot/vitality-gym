-- migrations/008_audit_log.sql
-- Append-only audit log for finance and security-sensitive tables.

CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text        NOT NULL,
  operation  text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id  uuid,
  changed_at timestamptz NOT NULL DEFAULT NOW(),
  old_data   jsonb,
  new_data   jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at   ON audit_log(changed_at DESC);

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log(table_name, operation, record_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to finance and security-sensitive tables
DROP TRIGGER IF EXISTS trg_audit_app_users     ON app_users;
DROP TRIGGER IF EXISTS trg_audit_pt_packages   ON pt_packages;
DROP TRIGGER IF EXISTS trg_audit_pt_sessions   ON pt_sessions;

CREATE TRIGGER trg_audit_app_users
  AFTER INSERT OR UPDATE OR DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_audit_pt_packages
  AFTER INSERT OR UPDATE OR DELETE ON pt_packages
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_audit_pt_sessions
  AFTER INSERT OR UPDATE OR DELETE ON pt_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
