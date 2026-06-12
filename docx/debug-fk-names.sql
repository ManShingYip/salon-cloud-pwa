-- ⚠️ 由於 constraint 名稱可能有變體，先用以下查詢確認實際存在嘅名稱
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE (conname LIKE '%staff%' OR conname LIKE '%new_staff%')
  AND contype = 'f';

-- 見到咩名就抄返落嚟逐個 drop
