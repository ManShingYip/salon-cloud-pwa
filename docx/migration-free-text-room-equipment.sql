-- ================================================================
-- Migration: 房間 & 儀器 → 自由文字輸入
-- 請在 Supabase SQL Editor 執行以下 SQL
-- ================================================================

-- Step 1: 改 room_id → room_name (TEXT)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_room_id_fkey;

-- 如果欄位仍叫 room_id，rename
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'room_id') THEN
    ALTER TABLE appointments RENAME COLUMN room_id TO room_name;
  END IF;
END $$;

ALTER TABLE appointments ALTER COLUMN room_name TYPE TEXT;
ALTER TABLE appointments ALTER COLUMN room_name SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN room_name SET DEFAULT '';


-- Step 2: 改 equipment_id → equipment_name (TEXT)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_equipment_id_fkey;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'equipment_id') THEN
    ALTER TABLE appointments RENAME COLUMN equipment_id TO equipment_name;
  END IF;
END $$;

ALTER TABLE appointments ALTER COLUMN equipment_name TYPE TEXT;


-- Step 3: 重建索引
DROP INDEX IF EXISTS idx_appt_room_date;
CREATE INDEX IF NOT EXISTS idx_appt_room_date ON appointments (room_name, appointment_date);

DROP INDEX IF EXISTS idx_appt_equip_date;
CREATE INDEX IF NOT EXISTS idx_appt_equip_date ON appointments (equipment_name, appointment_date);


-- Step 4: 更新 check_appointment_conflict RPC — room_id → room_name, equipment_id → equipment_name
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_appointment_date DATE,
  p_start_time       TIME,
  p_end_time         TIME,
  p_staff_id         UUID,
  p_room_name        TEXT DEFAULT NULL,
  p_equipment_name   TEXT DEFAULT NULL,
  p_exclude_appt_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  has_conflict    BOOLEAN,
  staff_conflict  BOOLEAN,
  room_conflict   BOOLEAN,
  equip_conflict  BOOLEAN
) AS $$
DECLARE
  conflicting RECORD;
BEGIN
  has_conflict := false;
  staff_conflict := false;
  room_conflict := false;
  equip_conflict := false;

  FOR conflicting IN
    SELECT staff_id, room_name, equipment_name
    FROM appointments
    WHERE appointment_date = p_appointment_date
      AND status != 'cancelled'
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_appt_id IS NULL OR id != p_exclude_appt_id)
  LOOP
    IF conflicting.staff_id = p_staff_id THEN
      staff_conflict := true;
      has_conflict := true;
    END IF;
    IF p_room_name IS NOT NULL AND p_room_name != '' AND conflicting.room_name = p_room_name THEN
      room_conflict := true;
      has_conflict := true;
    END IF;
    IF p_equipment_name IS NOT NULL AND p_equipment_name != '' AND conflicting.equipment_name = p_equipment_name THEN
      equip_conflict := true;
      has_conflict := true;
    END IF;
  END LOOP;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';


-- Step 5: 更新 COMMENT
COMMENT ON COLUMN appointments.room_name IS '自由文字輸入，唔再 FK 到 rooms 表';
COMMENT ON COLUMN appointments.equipment_name IS '自由文字輸入，可留空，唔再 FK 到 equipment 表';
