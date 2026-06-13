-- ================================================================
-- 一次性全部補執行：所有未 execute 嘅 SQL fix
-- ================================================================

-- 1. 房間/儀器改自由文字
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_room_id_fkey;
ALTER TABLE appointments RENAME COLUMN room_id TO room_name;
ALTER TABLE appointments ALTER COLUMN room_name TYPE TEXT;
ALTER TABLE appointments ALTER COLUMN room_name SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN room_name SET DEFAULT '';
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_equipment_id_fkey;
ALTER TABLE appointments RENAME COLUMN equipment_id TO equipment_name;
ALTER TABLE appointments ALTER COLUMN equipment_name TYPE TEXT;
DROP INDEX IF EXISTS idx_appt_room_date;
CREATE INDEX IF NOT EXISTS idx_appt_room_date ON appointments (room_name, appointment_date);
DROP INDEX IF EXISTS idx_appt_equip_date;
CREATE INDEX IF NOT EXISTS idx_appt_equip_date ON appointments (equipment_name, appointment_date);
COMMENT ON COLUMN appointments.room_name IS '自由文字輸入';
COMMENT ON COLUMN appointments.equipment_name IS '自由文字輸入，可留空';

-- 2. 移除 profiles FK to auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. profiles RLS — 開放 insert
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (public.is_admin());

-- 4. activity_log FK + RLS
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "log_select" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT USING (true);

-- 5. staff table RLS bypass
ALTER TABLE IF EXISTS staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON staff TO anon, authenticated;

-- 6. Reload
NOTIFY pgrst, 'reload schema';
