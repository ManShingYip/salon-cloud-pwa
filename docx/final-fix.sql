-- ================================================================
-- FINAL FIX: Drop ALL constraints with 'staff' or 'new_staff' in name
-- ================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE conname LIKE '%staff%' OR conname LIKE '%new_staff%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', r.tbl, r.conname);
    RAISE NOTICE 'Dropped: % on %', r.conname, r.tbl;
  END LOOP;
END $$;

-- Verify nothing left
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%staff%' OR conname LIKE '%new_staff%';

-- Rebuild to profiles
ALTER TABLE appointments ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE refunds ADD CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
