-- migrations/009_rls_policies.sql
-- RLS isolation: restrict anon/authenticated access to this gym's rows only.
-- Service role (used by API routes) bypasses RLS — that is intentional.

ALTER TABLE app_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_inquiries  ENABLE ROW LEVEL SECURITY;

-- app_users: gym isolation
DROP POLICY IF EXISTS gym_isolation ON app_users;
CREATE POLICY gym_isolation ON app_users
  USING (gym_id = '00000000-0000-0000-0000-000000000001');

-- pt_clients: gym isolation
DROP POLICY IF EXISTS gym_isolation ON pt_clients;
CREATE POLICY gym_isolation ON pt_clients
  USING (gym_id = '00000000-0000-0000-0000-000000000001');

-- pt_sessions: gym isolation
DROP POLICY IF EXISTS gym_isolation ON pt_sessions;
CREATE POLICY gym_isolation ON pt_sessions
  USING (gym_id = '00000000-0000-0000-0000-000000000001');

-- pt_inquiries: gym isolation (if table exists)
DROP POLICY IF EXISTS gym_isolation ON pt_inquiries;
CREATE POLICY gym_isolation ON pt_inquiries
  USING (gym_id = '00000000-0000-0000-0000-000000000001');
