-- profiles 表 PK = FK to auth.users，唔可以冇 auth account 就 insert
-- 解決方法：
-- Option A: 唔用 profiles 加人，獨立用返一個 staff 表 (冇 FK 限制)
-- Option B: 先用 service_role 建立 auth user + profiles

-- Option A is simpler — 但之前 staff 表 403
-- 問題根源：staff 表冇 GRANT 俾 anon
-- 以下手動 GRANT + 確保 staff 表 work

-- Step 1: Recreate staff table (if dropped)
CREATE TABLE IF NOT EXISTS staff (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: GRANT — this was the missing step!
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO anon, authenticated;

-- Step 3: RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_insert_all" ON staff;
DROP POLICY IF EXISTS "staff_update_all" ON staff;
DROP POLICY IF EXISTS "staff_delete_admin" ON staff;

CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);
CREATE POLICY "staff_delete_admin" ON staff FOR DELETE USING (true);

-- Step 4: Backfill from profiles
INSERT INTO staff (name, profile_id)
  SELECT name, id FROM profiles
  WHERE NOT EXISTS (SELECT 1 FROM staff WHERE staff.profile_id = profiles.id);

-- Step 5: Add a test
INSERT INTO staff (name) VALUES ('新員工Test') ON CONFLICT DO NOTHING;
