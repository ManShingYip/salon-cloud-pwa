-- ================================================================
-- 最簡單方案：放棄 staff 表，改返用 profiles
-- staff 表在 Supabase API 層面有 GRANT 問題（新表唔俾 anon access）
-- 我哋直接 extend profiles 表就夠，唔需要獨立 staff 表
-- ================================================================

-- 1. 還原 appointments FK → profiles
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS orig_staff_id UUID REFERENCES profiles(id) ON DELETE RESTRICT;

UPDATE appointments a
SET orig_staff_id = (SELECT s.profile_id FROM staff s WHERE s.id = a.staff_id)
WHERE a.orig_staff_id IS NULL;

UPDATE appointments
SET orig_staff_id = (SELECT id FROM profiles LIMIT 1)
WHERE orig_staff_id IS NULL;

ALTER TABLE appointments DROP COLUMN IF EXISTS staff_id;
ALTER TABLE appointments RENAME COLUMN orig_staff_id TO staff_id;
ALTER TABLE appointments ALTER COLUMN staff_id SET NOT NULL;
DROP INDEX IF EXISTS idx_appt_staff_date;
CREATE INDEX idx_appt_staff_date ON appointments (staff_id, appointment_date);

-- 2. 還原 staff_schedules FK → profiles
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_fkey;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS orig_staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

UPDATE staff_schedules ss
SET orig_staff_id = (SELECT s.profile_id FROM staff s WHERE s.id = ss.staff_id)
WHERE ss.orig_staff_id IS NULL;

ALTER TABLE staff_schedules DROP COLUMN IF EXISTS staff_id;
ALTER TABLE staff_schedules RENAME COLUMN orig_staff_id TO staff_id;
ALTER TABLE staff_schedules ALTER COLUMN staff_id SET NOT NULL;
DROP INDEX IF EXISTS idx_schedule_staff;
CREATE INDEX idx_schedule_staff ON staff_schedules (staff_id);

-- 3. 還原 payment_transactions FK
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_staff_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_settled_by_fkey;

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS orig_staff_id UUID REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS orig_settled_by UUID REFERENCES profiles(id) ON DELETE RESTRICT;

UPDATE payment_transactions pt
SET orig_staff_id = (SELECT s.profile_id FROM staff s WHERE s.id = pt.staff_id)
WHERE pt.orig_staff_id IS NULL;

UPDATE payment_transactions pt
SET orig_settled_by = (SELECT s.profile_id FROM staff s WHERE s.id = pt.settled_by)
WHERE pt.orig_settled_by IS NULL;

UPDATE payment_transactions SET orig_staff_id = (SELECT id FROM profiles LIMIT 1) WHERE orig_staff_id IS NULL;
UPDATE payment_transactions SET orig_settled_by = (SELECT id FROM profiles LIMIT 1) WHERE orig_settled_by IS NULL;

ALTER TABLE payment_transactions DROP COLUMN IF EXISTS staff_id;
ALTER TABLE payment_transactions DROP COLUMN IF EXISTS settled_by;
ALTER TABLE payment_transactions RENAME COLUMN orig_staff_id TO staff_id;
ALTER TABLE payment_transactions RENAME COLUMN orig_settled_by TO settled_by;
ALTER TABLE payment_transactions ALTER COLUMN staff_id SET NOT NULL;
ALTER TABLE payment_transactions ALTER COLUMN settled_by SET NOT NULL;

DROP INDEX IF EXISTS idx_paytx_staff;
DROP INDEX IF EXISTS idx_paytx_settled_by;
CREATE INDEX idx_paytx_staff ON payment_transactions (staff_id);
CREATE INDEX idx_paytx_settled_by ON payment_transactions (settled_by);

-- 4. 還原 refunds FK
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS orig_refunded_by UUID REFERENCES profiles(id) ON DELETE RESTRICT;

UPDATE refunds r
SET orig_refunded_by = (SELECT s.profile_id FROM staff s WHERE s.id = r.refunded_by)
WHERE r.orig_refunded_by IS NULL;

ALTER TABLE refunds DROP COLUMN IF EXISTS refunded_by;
ALTER TABLE refunds RENAME COLUMN orig_refunded_by TO refunded_by;
ALTER TABLE refunds ALTER COLUMN refunded_by SET NOT NULL;
DROP INDEX IF EXISTS idx_refunds_refunded;
CREATE INDEX idx_refunds_refunded ON refunds (refunded_by);

-- 5. 還原 activity_log FK
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS orig_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE activity_log al
SET orig_user_id = (SELECT s.profile_id FROM staff s WHERE s.id = al.user_id)
WHERE al.orig_user_id IS NULL;

ALTER TABLE activity_log DROP COLUMN IF EXISTS user_id;
ALTER TABLE activity_log RENAME COLUMN orig_user_id TO user_id;
DROP INDEX IF EXISTS idx_log_user;
CREATE INDEX idx_log_user ON activity_log (user_id);

-- 6. Rebuild RLS policy for activity_log
DROP POLICY IF EXISTS log_select ON activity_log;
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = auth.uid() OR (SELECT public.is_admin()));

-- 7. Drop staff table
DROP TABLE IF EXISTS staff CASCADE;
