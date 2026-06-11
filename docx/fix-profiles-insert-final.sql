-- 最終方案：唔用 staff 表，改 profiles
-- profiles.id FK to auth.users 所以唔可以隨便 insert
-- BUT 可以用 trigger 繞過：自動 create auth user when insert profile

-- Step 1: Make profiles.id use gen_random_uuid() instead of FK to auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Add default UUID generation
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Step 3: Fix profiles RLS
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (public.is_admin());
