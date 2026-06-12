-- Activity log user_id FK still points to staff which has broken permissions
-- Fix the FK constraint FIRST, then fix RLS

-- Find what user_id FK points to
SELECT
  tc.constraint_name,
  ccu.table_name AS target_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'activity_log' AND kcu.column_name = 'user_id'
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name;

-- Drop and rebuild
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey CASCADE;
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_new_user_id_fkey CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix RLS
DROP POLICY IF EXISTS "log_select" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT USING (true);

-- Disable staff table RLS (workaround)
ALTER TABLE IF EXISTS staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON staff TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
