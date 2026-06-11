-- ================================================================
-- 全面排查 + 修復 FK + Supabase schema cache reload
-- ================================================================

-- 1. Show current FK status
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('appointments','staff_schedules','payment_transactions','refunds','activity_log')
ORDER BY tc.table_name, kcu.column_name;

-- 2. Check if staff table still exists
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='staff') AS staff_exists;

-- 3. Rebuild FK to profiles IF missing
-- appointments.staff_id → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='appointments_staff_id_fkey') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- staff_schedules.staff_id → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='staff_schedules_staff_id_fkey') THEN
    ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_transactions.staff_id → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='payment_transactions_staff_id_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- payment_transactions.settled_by → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='payment_transactions_settled_by_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- refunds.refunded_by → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='refunds_refunded_by_fkey') THEN
    ALTER TABLE refunds ADD CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- activity_log.user_id → profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='activity_log_user_id_fkey') THEN
    ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
