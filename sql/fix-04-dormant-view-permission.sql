-- ============================================================
-- 🔴 緊急修復：dormant_clients View 權限
--    問題：security_invoker=true View 預設沒有 SELECT 權限
--    修法：GRANT SELECT 給 PUBLIC + Security Definer wrapper RPC
-- 執行方式：在 Supabase SQL Editor 中執行此整個檔案
-- ============================================================

-- Step 1: 授權 View 給所有角色
GRANT SELECT ON public.dormant_clients TO anon, authenticated, service_role;

-- Step 2: 備用方案 — Security Definer RPC 包裝（前端可用 RPC 或 View 讀取）
CREATE OR REPLACE FUNCTION public.list_dormant_clients()
RETURNS SETOF public.dormant_clients
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.dormant_clients;
$$;
