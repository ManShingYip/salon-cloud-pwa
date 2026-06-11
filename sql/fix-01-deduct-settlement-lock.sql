-- ============================================================
-- 🔴 漏洞一修復：deduct_service_from_appointment 加入結算鎖定檢查
-- 執行方式：在 Supabase SQL Editor 中執行此整個檔案
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_service_from_appointment(
  p_appointment_id  UUID,
  p_service_ids     UUID[],
  p_payment_method  TEXT DEFAULT 'cash',
  p_amount          NUMERIC(10,2) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_appt        public.appointments%ROWTYPE;
  v_user_id     UUID;
  v_svc         RECORD;
  v_total_amount NUMERIC(10,2) := 0;
  v_log_details JSONB;
  v_tx_id       UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未登入';
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到預約紀錄';
  END IF;

  -- 🔴 冪等檢查：已出席的預約不可重複扣數
  IF v_appt.status = 'attended' THEN
    RAISE EXCEPTION '此預約已標記為出席，不可重複扣減療程';
  END IF;

  -- 🔴 已取消的預約不可扣數
  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION '已取消的預約無法扣減療程';
  END IF;

  -- 🔴 漏洞一修復：檢查該預約日期是否已被結算鎖定
  --    已鎖定 = 禁止任何扣數操作，防止時空旅人竄改歷史帳目
  IF EXISTS (
    SELECT 1 FROM public.daily_settlements
    WHERE settlement_date = v_appt.appointment_date
      AND status = 'locked'
  ) THEN
    RAISE EXCEPTION '該日結算已鎖定，禁止補扣。請建立今日新預約處理。';
  END IF;

  -- 逐項檢查並扣減
  FOR v_svc IN
    SELECT cs.*, t.name AS treatment_name
    FROM client_services cs
    JOIN treatments t ON t.id = cs.treatment_id
    WHERE cs.id = ANY(p_service_ids)
      AND cs.client_id = v_appt.client_id
      AND cs.remaining_sessions > 0
      AND cs.status = 'active'
    FOR UPDATE
  LOOP
    IF v_svc.expiry_date IS NOT NULL AND v_svc.expiry_date < CURRENT_DATE THEN
      RAISE EXCEPTION '療程「%」已過期，無法扣減', v_svc.treatment_name;
    END IF;

    UPDATE client_services
    SET remaining_sessions = remaining_sessions - 1,
        status = CASE WHEN remaining_sessions - 1 <= 0 THEN 'expired' ELSE 'active' END
    WHERE id = v_svc.id;

    v_total_amount := v_total_amount + COALESCE(v_svc.unit_price, 0);

    v_log_details := jsonb_build_object(
      'before_remaining', v_svc.remaining_sessions,
      'after_remaining', v_svc.remaining_sessions - 1,
      'client_service_id', v_svc.id,
      'treatment_name', v_svc.treatment_name,
      'appointment_id', p_appointment_id
    );

    INSERT INTO activity_log (user_id, action_type, target_type, target_id, details)
    VALUES (v_user_id, 'deduct_service', 'client_service', v_svc.id, v_log_details);
  END LOOP;

  IF p_amount IS NOT NULL THEN
    v_total_amount := p_amount;
  END IF;

  UPDATE appointments
  SET status = 'attended', updated_at = now()
  WHERE id = p_appointment_id;

  INSERT INTO payment_transactions (
    appointment_id, client_id, treatment_id, staff_id,
    amount, payment_method, transaction_date, settled_by
  ) VALUES (
    v_appt.id, v_appt.client_id, v_appt.treatment_id, v_appt.staff_id,
    v_total_amount, p_payment_method, CURRENT_DATE, v_user_id
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO activity_log (user_id, action_type, target_type, target_id, details)
  VALUES (
    v_user_id, 'complete_deduction', 'appointment', p_appointment_id,
    jsonb_build_object(
      'deducted_services', p_service_ids,
      'total_amount', v_total_amount,
      'payment_method', p_payment_method,
      'transaction_id', v_tx_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'total_amount', v_total_amount,
    'message', '扣減完成'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
