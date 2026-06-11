-- 加返 staff 表嘅 RLS policies
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_insert_all" ON staff;
DROP POLICY IF EXISTS "staff_update_all" ON staff;

CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);
