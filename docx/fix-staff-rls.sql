-- ================================================================
-- Fix: staff 表 RLS policies — insert/update 開放俾所有人
-- ================================================================

DROP POLICY IF EXISTS "staff_insert_admin" ON staff;
DROP POLICY IF EXISTS "staff_update_admin" ON staff;
DROP POLICY IF EXISTS "staff_delete_admin" ON staff;

-- 所有人可以 insert（店長加人）
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);

-- 所有人可以 update（停用/改名）
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);

-- 僅店長可以 delete
CREATE POLICY "staff_delete_admin" ON staff FOR DELETE USING (public.is_admin());
