-- 清除殘留 test users
DELETE FROM profiles WHERE name IN ('新員工Test', '新美容師Cindy', 'Test', 'Test2', 'TestStaff');

-- Verify
SELECT id, name, role FROM profiles ORDER BY name;
