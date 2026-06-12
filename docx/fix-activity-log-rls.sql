DROP POLICY IF EXISTS "log_select" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT USING (true);
