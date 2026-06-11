-- ============================================================
-- 🔧 Supabase Linter 修復
-- 執行方式：在 Supabase SQL Editor 中執行此整個檔案
-- 日期：2026-06-11
-- ============================================================

-- ============================================================
-- 🔴 Fix 1: dormant_clients 視圖 — SECURITY DEFINER → SECURITY INVOKER
--    Severity: Critical
--    Issue: View was created with SECURITY DEFINER, which bypasses RLS.
--    Fix: Explicitly set security_invoker = true
-- ============================================================
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
-- 🟡 Fix 2: Auth RLS Initialization Plan — 避免每次政策評估重新呼叫 auth.uid()
--    Severity: Warning (suboptimal query performance at scale)
--    Fix: 將 auth.uid() 包裹在子查詢中，讓 PostgreSQL 只評估一次
-- ============================================================

-- 2a. profiles — SELECT 政策
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  USING (public.is_admin() OR (SELECT auth.uid()) = id);

-- 2b. profiles — UPDATE 政策
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  USING (public.is_admin() OR (SELECT auth.uid()) = id);

-- 2c. activity_log — 合併兩個 SELECT 政策 + 修正 auth.uid() 模式
DROP POLICY IF EXISTS "log_select_admin" ON activity_log;
DROP POLICY IF EXISTS "log_select_own" ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ============================================================
-- 🟡 Fix 3: _system_heartbeat — 內部表不需要 RLS
--    Severity: Warning (RLS Enabled No Policy)
--    Fix: Disable RLS on this internal-only table
-- ============================================================
ALTER TABLE _system_heartbeat DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 🟡 Fix 4: 補漏 FK 索引（高頻率 JOIN 欄位）
--    Severity: Info (Unindexed Foreign Keys)
--    Fix: 針對 payment_transactions + daily_settlements 的 FK 欄位補上索引
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
