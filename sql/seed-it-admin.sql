-- ============================================================
-- 🔐 IT 管理員種子資料（僅供緊急使用，平常不要用這個登入）
-- 執行方式：在 Supabase SQL Editor 中執行
-- ============================================================

-- Step 1: 在 Supabase Dashboard → Authentication → Users → Add User
--         手動建立：admin@salon.app，自己設一個強密碼
--         記下 UUID 後填入下面

-- Step 2: INSERT 到 profiles（換成你的 admin UUID）
-- INSERT INTO profiles (id, business_id, role, name)
-- VALUES ('<admin-uuid>', '00000000-0000-0000-0000-000000000001', 'shop_owner', 'IT管理員');

-- Step 3: 確認三條 profiles 都存在
SELECT id, role, name FROM profiles ORDER BY name;
