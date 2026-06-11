-- ================================================================
-- Migration: 加入 total_price 欄位到 client_services
-- 請在 Supabase SQL Editor 執行以下 SQL
-- ================================================================

-- Step 1: 加入 total_price 欄位
ALTER TABLE client_services
ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2);

-- Step 2: 填入現有資料 (total_price = unit_price × total_sessions)
UPDATE client_services
SET total_price = unit_price * total_sessions
WHERE total_price IS NULL;

-- Step 3: 設定 NOT NULL constraint (所有 row 已有值之後)
-- ALTER TABLE client_services ALTER COLUMN total_price SET NOT NULL;

-- Step 4: Update manual_grant_sessions RPC 加入 total_price
-- Run the function replacement below:
CREATE OR REPLACE FUNCTION manual_grant_sessions(
  p_client_id     UUID,
  p_treatment_id  UUID,
  p_sessions      INT,
  p_reason        TEXT DEFAULT NULL,
  p_unit_price    NUMERIC(10,2) DEFAULT NULL,
  p_expiry_date   DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_new_id  UUID;
  v_price   NUMERIC(10,2);
BEGIN
  v_user_id := auth.uid();

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '權限不足：只有店長可以贈送或新增療程次數';
  END IF;

  IF p_unit_price IS NOT NULL THEN
    v_price := p_unit_price;
  ELSE
    SELECT single_price INTO v_price FROM treatments WHERE id = p_treatment_id;
  END IF;

  INSERT INTO client_services (
    client_id, treatment_id, total_sessions, remaining_sessions,
    purchase_date, expiry_date, unit_price, total_price, status
  ) VALUES (
    p_client_id, p_treatment_id, p_sessions, p_sessions,
    CURRENT_DATE, p_expiry_date, COALESCE(v_price, 0),
    COALESCE(v_price, 0) * p_sessions, 'active'
  )
  RETURNING id INTO v_new_id;

  INSERT INTO activity_log (user_id, action_type, target_type, target_id, details)
  VALUES (
    v_user_id, 'grant_sessions', 'client_service', v_new_id,
    jsonb_build_object(
      'client_id', p_client_id,
      'treatment_id', p_treatment_id,
      'sessions', p_sessions,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_service_id', v_new_id,
    'message', '已新增 ' || p_sessions || ' 次療程'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
