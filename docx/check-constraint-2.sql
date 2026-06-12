-- final-fix 執行後 constraint 仲存在
-- 可能性：SQL Editor 未有執行權限，或者 constraint 在其他 schema
-- 以下手動 loop 逐個試
SELECT conname, conrelid::regclass AS tbl, contype
FROM pg_constraint
WHERE conname LIKE '%new_staff%' OR conname = 'appointments_staff_id_fkey'
ORDER BY conname;
