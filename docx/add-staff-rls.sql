-- ================================================================
-- 終極 Fix: staff 表 RLS policies（最終版）
-- 之前 staff 表 RLS policy 一直唔見，導致 403
-- ================================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_insert_all" ON staff;
DROP POLICY IF EXISTS "staff_update_all" ON staff;

CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);
CREATE POLICY "staff_delete_admin" ON staff FOR DELETE USING (public.is_admin());
