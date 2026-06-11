-- staff 表 RLS 已 disable，但仲係 permission denied
-- 說明 DB-level GRANT 未落到 anon role
-- 以下手動作 GRANT
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff TO anon, authenticated;

-- 如果上面唔得，試 grant all
GRANT ALL ON public.staff TO anon, authenticated;
GRANT ALL ON public.staff TO postgres, authenticated;
