ALTER TABLE activity_log DROP CONSTRAINT activity_log_user_id_fkey CASCADE;
ALTER TABLE activity_log DROP CONSTRAINT activity_log_new_user_id_fkey CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "log_select" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT USING (true);
ALTER TABLE IF EXISTS staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON staff TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
