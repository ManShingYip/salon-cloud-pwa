-- Drop profiles_id_fkey (FK to auth.users) specifically
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;

-- Verify it's gone
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass AND contype = 'f';
