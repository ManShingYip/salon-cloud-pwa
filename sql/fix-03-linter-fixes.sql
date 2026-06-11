-- ============================================================
-- 🔧 Supabase Linter 修復 + dormant_clients 重建
-- 執行方式：在 Supabase SQL Editor 中執行此整個檔案
-- 日期：2026-06-11
-- ============================================================

-- ============================================================
-- 🔴 Fix 1: dormant_clients 視圖 — 重建為 SECURITY INVOKER
--    (security_invoker = true 使用查詢者權限，尊重 RLS)
-- ============================================================
DROP VIEW IF EXISTS dormant_clients;
CREATE OR REPLACE VIEW dormant_clients WITH (security_invoker = true) AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.member_id,
  c.last_visit_date,
  (CURRENT_DATE - c.last_visit_date) AS dormant_days
FROM clients c
WHERE c.last_visit_date IS NOT NULL
  AND (CURRENT_DATE - c.last_visit_date) > 90
ORDER BY dormant_days DESC;

-- ============================================================
-- 🟡 Fix 2: Auth RLS 政策 — 避免 auth.uid() 重複評估
-- ============================================================

-- 2a. profiles — SELECT
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  USING (public.is_admin() OR (SELECT auth.uid()) = id);

-- 2b. profiles — UPDATE
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  USING (public.is_admin() OR (SELECT auth.uid()) = id);

-- 2c. activity_log — 合併 + 修正 auth.uid() 模式
DROP POLICY IF EXISTS "log_select_admin" ON activity_log;
DROP POLICY IF EXISTS "log_select_own" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ============================================================
-- 🟡 Fix 3: _system_heartbeat — 關閉 RLS
-- ============================================================
ALTER TABLE IF EXISTS _system_heartbeat DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 🟡 Fix 4: 補漏 FK 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_paytx_appointment ON payment_transactions (appointment_id);
CREATE INDEX IF NOT EXISTS idx_paytx_client      ON payment_transactions (client_id);
CREATE INDEX IF NOT EXISTS idx_paytx_treatment   ON payment_transactions (treatment_id);
CREATE INDEX IF NOT EXISTS idx_paytx_staff       ON payment_transactions (staff_id);
CREATE INDEX IF NOT EXISTS idx_paytx_settled_by  ON payment_transactions (settled_by);
CREATE INDEX IF NOT EXISTS idx_settle_locked_by  ON daily_settlements (locked_by);
CREATE INDEX IF NOT EXISTS idx_profiles_business ON profiles (business_id);
CREATE INDEX IF NOT EXISTS idx_schedule_staff    ON staff_schedules (staff_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refunded  ON refunds (refunded_by);
CREATE INDEX IF NOT EXISTS idx_settle_business   ON daily_settlements (business_id);
