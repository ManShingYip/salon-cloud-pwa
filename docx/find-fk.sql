-- ================================================================
-- Final: Get constraint name via SQL, drop it properly
-- ================================================================

-- Show all FK constraints on profiles
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass AND contype = 'f';

-- Drop it by name (replace with actual name if different)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;
