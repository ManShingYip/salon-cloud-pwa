-- ================================================================
-- TEST: 直接 check constraints, staff FK 指向
-- ================================================================

-- Show FK source→target
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS target_table,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'staff' OR tc.table_name IN ('appointments','staff_schedules','payment_transactions','refunds','activity_log'))
ORDER BY tc.table_name;
