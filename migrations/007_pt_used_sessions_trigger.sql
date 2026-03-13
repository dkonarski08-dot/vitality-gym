-- migrations/007_pt_used_sessions_trigger.sql
-- Keep pt_packages.used_sessions in sync with actual completed pt_sessions count.
-- Prevents application bugs from causing drift.

CREATE OR REPLACE FUNCTION sync_package_used_sessions()
RETURNS TRIGGER AS $$
DECLARE
  pkg_id uuid;
BEGIN
  pkg_id := COALESCE(NEW.package_id, OLD.package_id);
  IF pkg_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE pt_packages
  SET used_sessions = (
    SELECT COUNT(*)
    FROM pt_sessions
    WHERE package_id = pkg_id
      AND status = 'completed'
  )
  WHERE id = pkg_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pt_sessions_sync_used ON pt_sessions;
CREATE TRIGGER trg_pt_sessions_sync_used
  AFTER INSERT OR UPDATE OR DELETE ON pt_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_package_used_sessions();
