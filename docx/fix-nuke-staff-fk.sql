-- 🎯 Found the bug: "appointments_new_staff_id_fkey"
-- This is from migration-staff-table.sql Step 3 which created new_staff_id → staff
-- but then renamed to staff_id WITHOUT dropping the old constraint on staff table
-- The FK STILL POINTS TO staff table, not profiles!
-- staff table has RLS issues, causing 400 errors on all JOINs

-- FIX: Drop staff FK, rebuild → profiles

-- 1. Drop all staff FK constraints
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_new_staff_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey;
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_new_staff_id_fkey;
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_new_staff_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_staff_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_new_settled_by_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_settled_by_fkey;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_new_refunded_by_fkey;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey;
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_new_user_id_fkey;
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_new_created_by_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;

-- 2. Rebuild all → profiles
ALTER TABLE appointments ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE refunds ADD CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Drop staff table + its constraints
DROP TABLE IF EXISTS staff CASCADE;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Verify - should show profiles now
SELECT
  tc.table_name, kcu.column_name, ccu.table_name AS target_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('appointments','staff_schedules','payment_transactions','refunds','activity_log')
ORDER BY tc.table_name;
