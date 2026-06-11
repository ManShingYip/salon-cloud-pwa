-- ================================================================
-- Migration: 房間 & 儀器 → 自由文字輸入
-- 請在 Supabase SQL Editor 執行以下 SQL
-- ================================================================

-- Step 1: 改 room_id → room_name (TEXT)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_room_id_fkey;

ALTER TABLE appointments
  RENAME COLUMN room_id TO room_name;

ALTER TABLE appointments
  ALTER COLUMN room_name TYPE TEXT;


-- Step 2: 改 equipment_id → equipment_name (TEXT)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_equipment_id_fkey;

ALTER TABLE appointments
  RENAME COLUMN equipment_id TO equipment_name;

ALTER TABLE appointments
  ALTER COLUMN equipment_name TYPE TEXT;


-- Step 3: 重建索引
DROP INDEX IF EXISTS idx_appt_room_date;
CREATE INDEX IF NOT EXISTS idx_appt_room_date ON appointments (room_name, appointment_date);

DROP INDEX IF EXISTS idx_appt_equip_date;
CREATE INDEX IF NOT EXISTS idx_appt_equip_date ON appointments (equipment_name, appointment_date);


-- Step 4: 更新 COMMENT
COMMENT ON COLUMN appointments.room_name IS '自由文字輸入，唔再 FK 到 rooms 表';
COMMENT ON COLUMN appointments.equipment_name IS '自由文字輸入，可留空，唔再 FK 到 equipment 表';
