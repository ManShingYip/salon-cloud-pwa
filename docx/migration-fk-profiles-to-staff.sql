-- ================================================================
-- Migration: 將 settled_by + refunded_by FK 由 profiles → staff
-- ================================================================

-- Step 1: payment_transactions.settled_by → staff
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_settled_by_fkey;

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS new_settled_by UUID REFERENCES staff(id) ON DELETE RESTRICT;

UPDATE payment_transactions pt
SET new_settled_by = (
  SELECT s.id FROM staff s WHERE s.profile_id = pt.settled_by
)
WHERE pt.new_settled_by IS NULL;

UPDATE payment_transactions
SET new_settled_by = (SELECT id FROM staff LIMIT 1)
WHERE new_settled_by IS NULL;

ALTER TABLE payment_transactions DROP COLUMN IF EXISTS settled_by;
ALTER TABLE payment_transactions RENAME COLUMN new_settled_by TO settled_by;
ALTER TABLE payment_transactions ALTER COLUMN settled_by SET NOT NULL;

DROP INDEX IF EXISTS idx_paytx_settled_by;
CREATE INDEX idx_paytx_settled_by ON payment_transactions (settled_by);


-- Step 2: refunds.refunded_by → staff
ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey;

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS new_refunded_by UUID REFERENCES staff(id) ON DELETE RESTRICT;

UPDATE refunds r
SET new_refunded_by = (
  SELECT s.id FROM staff s WHERE s.profile_id = r.refunded_by
)
WHERE r.new_refunded_by IS NULL;

UPDATE refunds
SET new_refunded_by = (SELECT id FROM staff LIMIT 1)
WHERE new_refunded_by IS NULL;

ALTER TABLE refunds DROP COLUMN IF EXISTS refunded_by;
ALTER TABLE refunds RENAME COLUMN new_refunded_by TO refunded_by;
ALTER TABLE refunds ALTER COLUMN refunded_by SET NOT NULL;

DROP INDEX IF EXISTS idx_refunds_refunded;
CREATE INDEX idx_refunds_refunded ON refunds (refunded_by);


-- Step 3: appointments.created_by → staff
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS new_created_by UUID REFERENCES staff(id) ON DELETE RESTRICT;

UPDATE appointments a
SET new_created_by = (
  SELECT s.id FROM staff s WHERE s.profile_id = a.created_by
)
WHERE a.new_created_by IS NULL;

UPDATE appointments
SET new_created_by = (SELECT id FROM staff LIMIT 1)
WHERE new_created_by IS NULL;

ALTER TABLE appointments DROP COLUMN IF EXISTS created_by;
ALTER TABLE appointments RENAME COLUMN new_created_by TO created_by;
ALTER TABLE appointments ALTER COLUMN created_by SET NOT NULL;

DROP INDEX IF EXISTS idx_appt_created_by;
CREATE INDEX idx_appt_created_by ON appointments (created_by);


-- Step 4: daily_settlements.locked_by → staff
ALTER TABLE daily_settlements
  DROP CONSTRAINT IF EXISTS daily_settlements_locked_by_fkey;

ALTER TABLE daily_settlements
  ADD COLUMN IF NOT EXISTS new_locked_by UUID REFERENCES staff(id) ON DELETE SET NULL;

UPDATE daily_settlements ds
SET new_locked_by = (
  SELECT s.id FROM staff s WHERE s.profile_id = ds.locked_by
)
WHERE ds.new_locked_by IS NULL;

ALTER TABLE daily_settlements DROP COLUMN IF EXISTS locked_by;
ALTER TABLE daily_settlements RENAME COLUMN new_locked_by TO locked_by;

DROP INDEX IF EXISTS idx_settle_locked_by;
CREATE INDEX idx_settle_locked_by ON daily_settlements (locked_by);


-- Step 5: activity_log.user_id → staff (nullable)
DROP POLICY IF EXISTS log_select ON activity_log;

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS new_user_id UUID REFERENCES staff(id) ON DELETE SET NULL;

UPDATE activity_log al
SET new_user_id = (
  SELECT s.id FROM staff s WHERE s.profile_id = al.user_id
)
WHERE al.new_user_id IS NULL;

ALTER TABLE activity_log DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE activity_log RENAME COLUMN new_user_id TO user_id;

DROP INDEX IF EXISTS idx_log_user;
CREATE INDEX idx_log_user ON activity_log (user_id);

-- 重建 RLS policy（用新 column）
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = (SELECT s.id FROM staff s WHERE s.profile_id = auth.uid()) OR (SELECT public.is_admin()));


-- Step 6: COMMENT
COMMENT ON COLUMN payment_transactions.settled_by IS 'FK to staff';
COMMENT ON COLUMN refunds.refunded_by IS 'FK to staff';
COMMENT ON COLUMN appointments.created_by IS 'FK to staff';
COMMENT ON COLUMN daily_settlements.locked_by IS 'FK to staff';
COMMENT ON COLUMN activity_log.user_id IS 'FK to staff (nullable)';
