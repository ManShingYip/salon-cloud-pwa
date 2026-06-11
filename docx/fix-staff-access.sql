-- ================================================================
-- 最終 Fix: staff 表 API access
-- Supabase 新表需要 expose 俾 API
-- ================================================================

-- 1. Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant table access
GRANT ALL ON public.staff TO anon, authenticated;

-- 3. Make sure it's in the exposed schema (should already be)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 4. Drop + recreate RLS policies
DROP POLICY IF EXISTS "staff_select_all" ON public.staff;
DROP POLICY IF EXISTS "staff_insert_all" ON public.staff;
DROP POLICY IF EXISTS "staff_update_all" ON public.staff;

CREATE POLICY "staff_select_all" ON public.staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_all" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_all" ON public.staff FOR UPDATE USING (true);

-- 5. Verify
SELECT tablename, has_policies
FROM pg_tables
WHERE tablename='staff' AND schemaname='public';
