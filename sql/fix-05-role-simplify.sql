-- ============================================================
-- 🔧 角色簡化：全員 shop_owner
-- 執行方式：在 Supabase SQL Editor 中執行
-- ============================================================
UPDATE profiles SET role = 'shop_owner' WHERE role = 'staff';
