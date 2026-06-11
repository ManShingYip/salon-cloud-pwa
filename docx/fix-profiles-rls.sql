-- 將 profiles INSERT 開放俾所有人（而家只有 is_admin 先可以 insert）
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);

-- 同時 ensure profiles SELECT 開放俾所有人（用 anon key 唔經 auth.uid()）
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);

-- 同時 ensure profiles UPDATE 開放俾所有人
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);
