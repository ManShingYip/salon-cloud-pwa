-- 🎯 問題根源：appointments_new_staff_id_fkey 仍然存在，指向 staff
-- fix-nuke-staff-fk.sql 未執行。但唔緊要，我哋直接 drop 呢個 constraint by name

-- 睇下呢個 constraint 係咪仲存在
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%staff%' OR conname LIKE '%new_staff%';

-- 直接 drop 所有指向 staff 嘅 FK
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_new_staff_id_fkey CASCADE;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey CASCADE;

-- 加返指向 profiles
ALTER TABLE appointments ADD CONSTRAINT appointments_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE RESTRICT;

-- Reload
NOTIFY pgrst, 'reload schema';

-- Verify
INSERT INTO appointments (client_id, staff_id, treatment_id, room_name, appointment_date, start_time, end_time, status, created_by)
SELECT
  (SELECT id FROM clients LIMIT 1),
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM treatments LIMIT 1),
  'TestRoom',
  '2026-06-12',
  '10:00', '11:00',
  'confirmed',
  (SELECT id FROM profiles LIMIT 1)
WHERE EXISTS (SELECT 1 FROM clients) AND EXISTS (SELECT 1 FROM treatments);

-- Cleanup test
DELETE FROM appointments WHERE room_name = 'TestRoom';
