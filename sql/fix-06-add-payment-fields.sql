-- ==========================================
-- Payment & Refund Schema Enhancement
-- 喺 Supabase SQL Editor 執行
-- ==========================================

-- 1. payment_transactions 加實收金額 (方便記錄找續)
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS amount_received NUMERIC(10,2);

COMMENT ON COLUMN payment_transactions.amount_received
IS '客戶實付金額，用於計算找續。NULL = 未記錄';

-- 2. refunds 加退款方式
ALTER TABLE refunds
ADD COLUMN IF NOT EXISTS refund_method TEXT
CHECK (refund_method IN ('cash', 'card', 'transfer', 'other'));

COMMENT ON COLUMN refunds.refund_method
IS '退款方式：現金/信用卡/轉賬/其他';
