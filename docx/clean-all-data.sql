-- ================================================================
-- 安全清理全部測試資料（唔影響 staff / profiles / treatments）
-- 請在 Supabase SQL Editor 執行
-- ================================================================

DELETE FROM payment_transactions;
DELETE FROM refunds;
DELETE FROM client_services;
DELETE FROM appointments;
DELETE FROM activity_log;
DELETE FROM staff_schedules;
DELETE FROM clients;

-- Reset demo data IDs（可選）
-- treatments 保留唔郁
