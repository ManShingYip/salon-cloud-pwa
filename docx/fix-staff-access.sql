-- 最簡單 fix：disable staff 表 RLS，唔需要權限控制
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- 如果上面唔 work，用 GRANT
GRANT SELECT, INSERT, UPDATE ON staff TO authenticated, anon;
