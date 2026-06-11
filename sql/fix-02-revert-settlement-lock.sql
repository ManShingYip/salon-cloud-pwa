-- ============================================================
-- 🔴 漏洞一修復：revert_attended_to_confirmed 加入結算鎖定檢查
-- 執行方式：在 Supabase SQL Editor 中執行此整個檔案
-- ============================================================
CREATE OR REPLACE FUNCTION revert_attended_to_confirmed(
  p_appointment_id UUID,
  p_reason         TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id     UUID;
  v_appt        public.appointments%ROWTYPE;
  v_log         RECORD;
  v_restored    INT := 0;
  v_tx_ids      UUID[] := '{}';
BEGIN
  v_user_id := auth.uid();

  -- 🔴 權限檢查：僅店長
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '權限不足：只有店長可以退回已出席的預約';
  END IF;

  -- 鎖定預約行
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到預約紀錄';
  END IF;

  -- 🔴 只有 attended 可以退回
  --    這是漏洞二的核心防線：SELECT ... FOR UPDATE 鎖定行 + 狀態檢查
  --    第二個請求進來時，status 已被第一個請求改成 confirmed → 拒絕
  IF v_appt.status != 'attended' THEN
    RAISE EXCEPTION '只有已出席的預約可以退回，目前狀態：%', v_appt.status;
  END IF;

  -- 🔴 漏洞一修復：檢查該預約日期是否已被結算鎖定
  IF EXISTS (
    SELECT 1 FROM public.daily_settlements
    WHERE settlement_date = v_appt.appointment_date
      AND status = 'locked'
  ) THEN
    RAISE EXCEPTION '該日結算已鎖定，禁止退回。請以其他方式處理差額。';
  END IF;

  -- 收集所有由此次預約產生的扣減 log
  FOR v_log IN
    SELECT al.target_id AS client_service_id,
           (al.details->>'after_remaining')::INT AS after_remaining,
           (al.details->>'before_remaining')::INT AS before_remaining
    FROM public.activity_log al
    WHERE al.action_type = 'deduct_service'
      AND al.details->>'appointment_id' = p_appointment_id::TEXT
  LOOP
    -- 回補 client_services 次數
    UPDATE public.client_services
    SET remaining_sessions = remaining_sessions + 1,
        status = 'active'
    WHERE id = v_log.client_service_id;

    IF FOUND THEN
      v_restored := v_restored + 1;

      -- 寫入退回明細 Log
      INSERT INTO public.activity_log (user_id, action_type, target_type, target_id, details)
      VALUES (
        v_user_id,
        'revert_deduction',
        'client_service',
        v_log.client_service_id,
        jsonb_build_object(
          'appointment_id', p_appointment_id,
          'restored_sessions', 1,
          'before_remaining', COALESCE(v_log.after_remaining, 0),
          'after_remaining', COALESCE(v_log.after_remaining, 0) + 1,
          'reason', p_reason
        )
      );
    END IF;
  END LOOP;

  -- 標記所有關聯的 payment_transactions 為 VOID
  WITH updated AS (
    UPDATE public.payment_transactions
    SET remarks = COALESCE(remarks || ' | ', '') || '[VOID] 店長退回: ' || p_reason
    WHERE appointment_id = p_appointment_id
    RETURNING id
  )
  SELECT array_agg(id) INTO v_tx_ids FROM updated;

  -- 更新預約狀態回 confirmed
  UPDATE public.appointments
  SET status = 'confirmed',
      remarks = COALESCE(remarks || ' | ', '') || '🔙 店長退回(' || now()::DATE::TEXT || '): ' || p_reason,
      updated_at = now()
  WHERE id = p_appointment_id;

  -- 寫入退回摘要 Log
  INSERT INTO public.activity_log (user_id, action_type, target_type, target_id, details)
  VALUES (
    v_user_id,
    'revert_appointment',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'previous_status', 'attended',
      'new_status', 'confirmed',
      'reason', p_reason,
      'restored_services_count', v_restored,
      'voided_transaction_ids', v_tx_ids
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'restored_count', v_restored,
    'voided_transactions', v_tx_ids,
    'message', '已退回 ' || v_restored || ' 筆療程扣減，預約回到「已確認」'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
