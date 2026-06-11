-- ================================================================
-- Fix: staff 表 RLS policies（insert/update/delete 覆蓋返 migration-staff-table.sql）
-- 請選擇然後執行
-- ================================================================

-- 確保 RLS 已啟用
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- 刪除可能已有嘅同名 policies
DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_insert_all" ON staff;
DROP POLICY IF EXISTS "staff_update_all" ON staff;
DROP POLICY IF EXISTS "staff_delete_admin" ON staff;

-- 所有人可讀
CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);

-- 所有人可以 insert（店長加人）
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);

-- 所有人可以 update（停用/改名）
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);

-- 僅店長可以 delete
CREATE POLICY "staff_delete_admin" ON staff FOR DELETE USING (public.is_admin());
