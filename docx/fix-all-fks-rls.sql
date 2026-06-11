-- ================================================================
-- 一次性 Fix all RLS + FK 殘留問題
-- ================================================================

-- ─── 1. staff 表 RLS ──────────────────────────────
DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_insert_admin" ON staff;
DROP POLICY IF EXISTS "staff_insert_all" ON staff;
DROP POLICY IF EXISTS "staff_update_admin" ON staff;
DROP POLICY IF EXISTS "staff_update_all" ON staff;

CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_all" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON staff FOR UPDATE USING (true);
-- delete: 冇 policy = 冇人可以 delete

-- ─── 2. refunds 表 FK 修正 ─────────────────────────
--    refunded_by column 可能仲指緊 profiles，唔係 staff
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='refunds' AND column_name='refunded_by') THEN
    -- 如果 refunded_by 仲係 FK to profiles，改成 FK to staff
    ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey;
  END IF;
END $$;

-- 確保 refunded_by 指向 staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'refunds' AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'staff' AND ccu.column_name = 'id'
  ) THEN
    ALTER TABLE refunds ADD CONSTRAINT refunds_refunded_by_fkey
      FOREIGN KEY (refunded_by) REFERENCES staff(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ─── 3. payment_transactions FK 修正 ───────────────
--    staff_id 已 OK, settled_by 需要確認 FK to staff
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_settled_by_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_staff_id_fkey;

ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
  ADD CONSTRAINT payment_transactions_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES staff(id) ON DELETE RESTRICT;

-- ─── 4. appointments FK 修正 ────────────────────────
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE RESTRICT;

-- ─── 5. staff_schedules FK 修正 ─────────────────────
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_fkey;
ALTER TABLE staff_schedules
  ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- ─── 6. activity_log — profiles column cleanup ─────
--    check 如果 activity_log 仲有 profiles(name) reference
--    呢個 fix 針對前線 query: activity_log 中 profiles 已唔存在
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
-- 確保 FK 指向 staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'activity_log' AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'staff' AND ccu.column_name = 'id'
  ) THEN
    ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 7. RLS: enable on all if not enabled ──────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename NOT IN ('_system_heartbeat','dormant_clients')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
