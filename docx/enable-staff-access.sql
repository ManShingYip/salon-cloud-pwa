ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON staff TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
