-- Step 1: 睇下 constraint 係咪仲存在
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%staff%' OR conname LIKE '%new_staff%';
