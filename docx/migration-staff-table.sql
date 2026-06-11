-- ================================================================
-- Migration: 獨立 staff 表（與 auth.users 脫勾）
-- 請在 Supabase SQL Editor 執行以下 SQL
-- ================================================================

-- Step 1: 建立 staff 表
CREATE TABLE IF NOT EXISTS staff (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- 可選：連到 auth user
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Backfill — 將現有 profiles 抄入 staff
INSERT INTO staff (id, name, profile_id)
  SELECT gen_random_uuid(), name, id FROM profiles
  WHERE NOT EXISTS (SELECT 1 FROM staff);

-- Step 3: 將現有 appointments.staff_id 搬到 staff 表
--    appointments.staff_id → 先 rename 保留舊 FK
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey;

-- 加 new_staff_id column
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS new_staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT;

-- 把現有 staff_id map 到 new_staff_id（經 profiles 搵 staff）
UPDATE appointments a
SET new_staff_id = (
  SELECT s.id FROM staff s WHERE s.profile_id = a.staff_id
)
WHERE a.new_staff_id IS NULL;

-- 如果有 appointment 搵唔到 staff，assign first staff
UPDATE appointments
SET new_staff_id = (SELECT id FROM staff LIMIT 1)
WHERE new_staff_id IS NULL;

-- Drop old + rename
ALTER TABLE appointments DROP COLUMN IF EXISTS staff_id;
ALTER TABLE appointments RENAME COLUMN new_staff_id TO staff_id;
ALTER TABLE appointments ALTER COLUMN staff_id SET NOT NULL;

-- 重建索引
DROP INDEX IF EXISTS idx_appt_staff_date;
CREATE INDEX idx_appt_staff_date ON appointments (staff_id, appointment_date);


-- Step 4: staff_schedules.staff_id → FK to staff
ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_fkey;

-- 加 new_staff_id
ALTER TABLE staff_schedules
  ADD COLUMN IF NOT EXISTS new_staff_id UUID REFERENCES staff(id) ON DELETE CASCADE;

-- Map
UPDATE staff_schedules ss
SET new_staff_id = (
  SELECT s.id FROM staff s WHERE s.profile_id = ss.staff_id
)
WHERE ss.new_staff_id IS NULL;

-- Drop old + rename
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS staff_id;
ALTER TABLE staff_schedules RENAME COLUMN new_staff_id TO staff_id;
ALTER TABLE staff_schedules ALTER COLUMN staff_id SET NOT NULL;

-- 重建索引
DROP INDEX IF EXISTS idx_schedule_staff;
CREATE INDEX idx_schedule_staff ON staff_schedules (staff_id);


-- Step 5: payment_transactions.staff_id — same migration
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_staff_id_fkey;

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS new_staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT;

UPDATE payment_transactions pt
SET new_staff_id = (
  SELECT s.id FROM staff s WHERE s.profile_id = pt.staff_id
)
WHERE pt.new_staff_id IS NULL;

UPDATE payment_transactions
SET new_staff_id = (SELECT id FROM staff LIMIT 1)
WHERE new_staff_id IS NULL;

ALTER TABLE payment_transactions DROP COLUMN IF EXISTS staff_id;
ALTER TABLE payment_transactions RENAME COLUMN new_staff_id TO staff_id;
ALTER TABLE payment_transactions ALTER COLUMN staff_id SET NOT NULL;

DROP INDEX IF EXISTS idx_paytx_staff;
CREATE INDEX idx_paytx_staff ON payment_transactions (staff_id);


-- Step 6: update RPC — deduct_service_from_appointment
--    (staff_id 仍係 UUID，只係指緊 staff 表而唔係 profiles，唔使改)

-- Step 7: update check_appointment_conflict — staff_id FK 仍係 UUID，OK


-- Step 8: RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_select_all" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_admin" ON staff FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "staff_update_admin" ON staff FOR UPDATE USING (public.is_admin());
CREATE POLICY "staff_delete_admin" ON staff FOR DELETE USING (public.is_admin());

-- Step 9: COMMENT
COMMENT ON TABLE staff IS '員工表 — 獨立於 auth.users，店長可自由新增/停用';
COMMENT ON COLUMN staff.profile_id IS '可選：連接到 auth user（如有登入帳號），冇 account 嘅純員工留空';
