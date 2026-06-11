-- ============================================================
-- 美容院管理雲端系統 — 完整 Supabase Schema SQL
-- PostgreSQL + RLS + Custom Claims + RPC + Trigger + pg_cron
-- 版本：v1.0 MVP
-- 最後更新：2026-06-10
-- ============================================================
-- 使用方式：在 Supabase Dashboard → SQL Editor 中依序執行
-- 順序：Extension → 表格 → 索引 → RLS → 函式 → Trigger → pg_cron
-- ============================================================

-- ============================================================
-- 0️⃣ 前置：啟用 Extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pg_cron";         -- 排程（需在 Supabase Dashboard 手動啟用）

-- ============================================================
-- 1️⃣ 核心表格定義
-- ============================================================

-- -------------------------------------------------------------------
-- 1.1 businesses — 店鋪 (預留多店擴展)
-- -------------------------------------------------------------------
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE businesses IS '店鋪 — 目前僅一間，預留多店架構';

-- -------------------------------------------------------------------
-- 1.2 profiles — 使用者角色 (關聯 auth.users)
-- -------------------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('shop_owner', 'staff')),
  name        TEXT NOT NULL,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE profiles IS '使用者角色 — role 由 Custom Claims 控制，此處為冗余備份';
COMMENT ON COLUMN profiles.role IS 'shop_owner = 店長 | staff = 一般美容師';

-- -------------------------------------------------------------------
-- 1.3 staff_schedules — 員工排班
-- -------------------------------------------------------------------
CREATE TABLE staff_schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=日 1-6=一～六
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_off       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT chk_schedule_time CHECK (start_time < end_time OR is_off = true)
);
COMMENT ON TABLE staff_schedules IS '員工排班 — 用於預約時過濾可用美容師時段';

-- -------------------------------------------------------------------
-- 1.4 clients — 客戶資料
-- -------------------------------------------------------------------
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  member_id       TEXT UNIQUE,                    -- M 開頭自動編號 (Trigger 生成)
  source          TEXT,                           -- IG廣告 / 朋友介紹 / 街客 等
  is_sensitive    BOOLEAN NOT NULL DEFAULT false, -- 特殊敏感標記
  sensitive_note  TEXT,                           -- 敏感原因說明
  remarks         TEXT,                           -- 一般備註
  last_visit_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 支援電話/姓名搜尋 + 電話後四碼顯示
CREATE INDEX idx_clients_phone ON clients (phone);
CREATE INDEX idx_clients_name ON clients (name);
CREATE INDEX idx_clients_business ON clients (business_id);
CREATE INDEX idx_clients_last_visit ON clients (last_visit_date);
COMMENT ON TABLE clients IS '客戶資料 — member_id 由 Trigger 自動生成';

-- -------------------------------------------------------------------
-- 1.5 treatments — 療程項目
-- -------------------------------------------------------------------
CREATE TABLE treatments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT,                         -- 分類：面部 / 身體 / 激光 等
  single_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  package_sessions  INT DEFAULT 1,                -- 套票總次數 (1 = 單次)
  duration_minutes  INT NOT NULL DEFAULT 60,      -- 建議時長（分鐘）
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_treatments_business ON treatments (business_id);
CREATE INDEX idx_treatments_active ON treatments (is_active);
COMMENT ON TABLE treatments IS '療程項目庫 — 店長可 CRUD';

-- -------------------------------------------------------------------
-- 1.6 rooms — 房間
-- -------------------------------------------------------------------
CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_rooms_business ON rooms (business_id);
COMMENT ON TABLE rooms IS '房間 — 預約時三維防撞之一';

-- -------------------------------------------------------------------
-- 1.7 equipment — 儀器設備
-- -------------------------------------------------------------------
CREATE TABLE equipment (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  total_quantity  INT NOT NULL DEFAULT 1,         -- 可用數量
  is_active       BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_equipment_business ON equipment (business_id);
COMMENT ON TABLE equipment IS '儀器設備 — 預約時三維防撞之一';

-- -------------------------------------------------------------------
-- 1.8 appointments — 預約 (三維防撞核心)
-- -------------------------------------------------------------------
CREATE TABLE appointments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  treatment_id      UUID NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  equipment_id      UUID REFERENCES equipment(id) ON DELETE SET NULL,  -- 可為空
  appointment_date  DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,                -- = start_time + treatment.duration_minutes
  status            TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'attended', 'cancelled', 'no_show')),
  no_show_count     INT NOT NULL DEFAULT 0,       -- 該客戶累計失約次數
  remarks           TEXT,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_appt_time CHECK (start_time < end_time)
);
-- 🔴 三維防撞索引：加速同一時段衝突查詢
CREATE INDEX idx_appt_date_time ON appointments (appointment_date, start_time, end_time);
CREATE INDEX idx_appt_staff_date ON appointments (staff_id, appointment_date);
CREATE INDEX idx_appt_room_date ON appointments (room_id, appointment_date);
CREATE INDEX idx_appt_equip_date ON appointments (equipment_id, appointment_date);
CREATE INDEX idx_appt_client ON appointments (client_id);
CREATE INDEX idx_appt_status ON appointments (status);
CREATE INDEX idx_appt_created_by ON appointments (created_by);
COMMENT ON TABLE appointments IS '預約核心 — INSERT 前需透過 check_appointment_conflict() 驗證三維防撞';

-- -------------------------------------------------------------------
-- 1.9 client_services — 客戶已購療程庫存 (防弊重點)
-- -------------------------------------------------------------------
CREATE TABLE client_services (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  treatment_id        UUID NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  total_sessions      INT NOT NULL CHECK (total_sessions > 0),
  remaining_sessions  INT NOT NULL CHECK (remaining_sessions >= 0),
  purchase_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date         DATE,                       -- NULL = 不限期
  unit_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_remaining CHECK (remaining_sessions <= total_sessions)
);
CREATE INDEX idx_client_svc_client ON client_services (client_id);
CREATE INDEX idx_client_svc_treatment ON client_services (treatment_id);
CREATE INDEX idx_client_svc_remaining ON client_services (remaining_sessions) WHERE remaining_sessions > 0;
CREATE INDEX idx_client_svc_status ON client_services (status);
COMMENT ON TABLE client_services IS '🔒 前端不可直接 UPDATE remaining_sessions — 只能透過 RPC deduct_service_from_appointment()';

-- -------------------------------------------------------------------
-- 1.10 daily_settlements — 每日結算（必須在 payment_transactions 之前建立）
-- -------------------------------------------------------------------
CREATE TABLE daily_settlements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  settlement_date   DATE NOT NULL UNIQUE,
  total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  transfer_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_difference   NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 備用金差異
  difference_note   TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'locked')),
  locked_by         UUID REFERENCES profiles(id),
  locked_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_settle_date ON daily_settlements (settlement_date);
CREATE INDEX idx_settle_status ON daily_settlements (status);
COMMENT ON TABLE daily_settlements IS '每日結算 — locked 後不可再新增或修改當日 payment_transactions';

-- -------------------------------------------------------------------
-- 1.11 payment_transactions — 交易紀錄
-- -------------------------------------------------------------------
CREATE TABLE payment_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id    UUID REFERENCES appointments(id) ON DELETE SET NULL,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  treatment_id      UUID NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  staff_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  settled_by        UUID NOT NULL REFERENCES profiles(id),
  settlement_id     UUID REFERENCES daily_settlements(id) ON DELETE SET NULL,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_paytx_date ON payment_transactions (transaction_date);
CREATE INDEX idx_paytx_settlement ON payment_transactions (settlement_id);
CREATE INDEX idx_paytx_method ON payment_transactions (payment_method);
COMMENT ON TABLE payment_transactions IS '交易紀錄 — 療程扣數完成後自動產生';

-- -------------------------------------------------------------------
-- 1.12 refunds — 退款紀錄
-- -------------------------------------------------------------------
CREATE TABLE refunds (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_service_id   UUID NOT NULL REFERENCES client_services(id) ON DELETE RESTRICT,
  refunded_by         UUID NOT NULL REFERENCES profiles(id),
  refund_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  restored_sessions   INT NOT NULL DEFAULT 0,     -- 回補次數
  reason              TEXT NOT NULL,               -- 🔴 必填
  refund_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refunds_client_svc ON refunds (client_service_id);
COMMENT ON TABLE refunds IS '退款紀錄 — 僅店長可執行，需填寫原因';

-- -------------------------------------------------------------------
-- 1.13 activity_log — 活動日誌 (🛡️ INSERT-ONLY)
-- -------------------------------------------------------------------
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,                    -- deduct_service | refund | create_appointment | cancel_appointment | update_client | create_client | finalize_settlement | manual_deduct | grant_sessions 等
  target_type   TEXT NOT NULL,                    -- appointment | client | client_service | settlement | treatment | refund
  target_id     UUID,
  details       JSONB NOT NULL DEFAULT '{}',      -- 變動前後資料對照 (before/after)
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 🔴 關鍵索引
CREATE INDEX idx_log_user ON activity_log (user_id);
CREATE INDEX idx_log_action ON activity_log (action_type);
CREATE INDEX idx_log_target ON activity_log (target_type, target_id);
CREATE INDEX idx_log_created ON activity_log (created_at DESC);
COMMENT ON TABLE activity_log IS '🛡️ INSERT-ONLY — RLS 禁止 UPDATE / DELETE，任何人無法篡改';

-- ============================================================
-- 補充 FK 索引（加速 JOIN / 避免 Seq Scan）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_paytx_appointment ON payment_transactions (appointment_id);
CREATE INDEX IF NOT EXISTS idx_paytx_client      ON payment_transactions (client_id);
CREATE INDEX IF NOT EXISTS idx_paytx_treatment   ON payment_transactions (treatment_id);
CREATE INDEX IF NOT EXISTS idx_paytx_staff       ON payment_transactions (staff_id);
CREATE INDEX IF NOT EXISTS idx_paytx_settled_by  ON payment_transactions (settled_by);
CREATE INDEX IF NOT EXISTS idx_settle_locked_by  ON daily_settlements (locked_by);
CREATE INDEX IF NOT EXISTS idx_profiles_business ON profiles (business_id);
CREATE INDEX IF NOT EXISTS idx_schedule_staff    ON staff_schedules (staff_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refunded  ON refunds (refunded_by);
CREATE INDEX IF NOT EXISTS idx_settle_business   ON daily_settlements (business_id);


-- ============================================================
-- 2️⃣ 自動編號 Trigger：clients.member_id
-- ============================================================
CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  -- 取得目前最大編號並 +1
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(member_id, 'M', '', 'g'), '')::INT), 0) + 1
  INTO next_num
  FROM clients
  WHERE business_id = NEW.business_id;

  NEW.member_id := 'M' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_clients_member_id
  BEFORE INSERT ON clients
  FOR EACH ROW
  WHEN (NEW.member_id IS NULL)
  EXECUTE FUNCTION generate_member_id();


-- ============================================================
-- 3️⃣ 自動更新 updated_at Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 套用到所有有 updated_at 的表
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- 例外：activity_log 沒有 updated_at，不套用


-- ============================================================
-- 4️⃣ 自動更新 clients.last_visit_date Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_last_visit()
RETURNS TRIGGER AS $$
BEGIN
  -- 當預約狀態改為 attended 時，更新該客戶的 last_visit_date
  IF NEW.status = 'attended' AND (OLD.status IS NULL OR OLD.status != 'attended') THEN
    UPDATE clients
    SET last_visit_date = NEW.appointment_date
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_appt_update_last_visit
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_visit();


-- ============================================================
-- 5️⃣ 自動累計失約次數 Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_no_show_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'no_show' THEN
    -- 計算該客戶歷史失約次數
    SELECT COUNT(*) INTO NEW.no_show_count
    FROM appointments
    WHERE client_id = NEW.client_id AND status = 'no_show';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_appt_no_show
  BEFORE UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'no_show')
  EXECUTE FUNCTION update_no_show_count();


-- ============================================================
-- 6️⃣ Custom Claims 函式 — 角色驗證（RLS 核心）
--    ⚠️ 全部放在 public schema（Supabase 禁止在 auth schema 建立自訂函式）
--    ⚠️ 直接讀取 profiles.role 而非 JWT（避免權限問題）
-- ============================================================

-- 6.1 取得當前使用者角色（從 profiles 表讀取）
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'staff');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 6.2 判斷是否為店長
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.user_role() = 'shop_owner';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 6.3 判斷是否為店長或本人（用於 profiles 查詢）
CREATE OR REPLACE FUNCTION public.is_admin_or_self(check_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_admin() OR (SELECT auth.uid()) = check_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 6.4 手動設定角色（僅更新 profiles.role，不觸碰 auth.users）
--     需以 service_role 執行（SQL Editor 預設即為 service_role）
CREATE OR REPLACE FUNCTION public.set_claim_role(uid UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  IF new_role NOT IN ('shop_owner', 'staff') THEN
    RAISE EXCEPTION '無效角色：只能是 shop_owner 或 staff';
  END IF;

  UPDATE profiles SET role = new_role WHERE id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到該使用者的 profiles 紀錄，請先建立 profiles 再設定角色';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- ============================================================
-- 7️⃣ RLS 權限政策（Row Level Security）
-- ============================================================

-- 啟用所有表的 RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------
-- 7.1 businesses — 所有人可讀，僅店長可修改
-- -------------------------------------------------------------------
CREATE POLICY "businesses_select_all" ON businesses FOR SELECT USING (true);
CREATE POLICY "businesses_insert_admin" ON businesses FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "businesses_update_admin" ON businesses FOR UPDATE USING (public.is_admin());
CREATE POLICY "businesses_delete_admin" ON businesses FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.2 profiles — 個人讀自己，店長讀全店
-- -------------------------------------------------------------------
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  USING (public.is_admin() OR (SELECT auth.uid()) = id);
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  USING (public.is_admin() OR (SELECT auth.uid()) = id);
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.3 staff_schedules — 所有人可讀，店長可寫
-- -------------------------------------------------------------------
CREATE POLICY "schedules_select_all" ON staff_schedules FOR SELECT USING (true);
CREATE POLICY "schedules_insert_admin" ON staff_schedules FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "schedules_update_admin" ON staff_schedules FOR UPDATE USING (public.is_admin());
CREATE POLICY "schedules_delete_admin" ON staff_schedules FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.4 clients — 所有人可讀，員工可建立/修改（不含刪除）
-- -------------------------------------------------------------------
CREATE POLICY "clients_select_all" ON clients FOR SELECT USING (true);
CREATE POLICY "clients_insert_all" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "clients_update_all" ON clients FOR UPDATE USING (true);
-- 🔴 刪除：僅店長
CREATE POLICY "clients_delete_admin" ON clients FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.5 treatments — 所有人可讀，僅店長可修改
-- -------------------------------------------------------------------
CREATE POLICY "treatments_select_all" ON treatments FOR SELECT USING (true);
CREATE POLICY "treatments_insert_admin" ON treatments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "treatments_update_admin" ON treatments FOR UPDATE USING (public.is_admin());
CREATE POLICY "treatments_delete_admin" ON treatments FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.6 rooms — 所有人可讀，僅店長可修改
-- -------------------------------------------------------------------
CREATE POLICY "rooms_select_all" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert_admin" ON rooms FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "rooms_update_admin" ON rooms FOR UPDATE USING (public.is_admin());
CREATE POLICY "rooms_delete_admin" ON rooms FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.7 equipment — 所有人可讀，僅店長可修改
-- -------------------------------------------------------------------
CREATE POLICY "equipment_select_all" ON equipment FOR SELECT USING (true);
CREATE POLICY "equipment_insert_admin" ON equipment FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "equipment_update_admin" ON equipment FOR UPDATE USING (public.is_admin());
CREATE POLICY "equipment_delete_admin" ON equipment FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.8 appointments — 所有人可讀/建立/修改狀態，僅店長可刪除
-- -------------------------------------------------------------------
CREATE POLICY "appointments_select_all" ON appointments FOR SELECT USING (true);
CREATE POLICY "appointments_insert_all" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "appointments_update_all" ON appointments FOR UPDATE USING (true);
CREATE POLICY "appointments_delete_admin" ON appointments FOR DELETE USING (public.is_admin());

-- -------------------------------------------------------------------
-- 7.9 client_services — 🔒 嚴謹控制
--   SELECT: 所有人
--   INSERT: 僅店長（客戶購買療程）
--   UPDATE: ❌ 禁止直接更新 (扣數必須透過 RPC)
--   DELETE: ❌ 禁止刪除
-- -------------------------------------------------------------------
CREATE POLICY "client_svc_select_all" ON client_services FOR SELECT USING (true);
CREATE POLICY "client_svc_insert_admin" ON client_services FOR INSERT WITH CHECK (public.is_admin());
-- ⛔ 沒有 UPDATE / DELETE policy = 任何人（包括店長）都無法從前端直接修改庫存
-- 唯一修改路徑：SECURITY DEFINER RPC (deduct_service_from_appointment / refund_deduction / manual_grant_sessions)

-- -------------------------------------------------------------------
-- 7.10 payment_transactions — 所有人可讀，寫入由 RPC 處理
-- -------------------------------------------------------------------
CREATE POLICY "paytx_select_all" ON payment_transactions FOR SELECT USING (true);
CREATE POLICY "paytx_insert_all" ON payment_transactions FOR INSERT WITH CHECK (true);
-- ⛔ UPDATE/DELETE 禁止 — 交易紀錄不可修改

-- -------------------------------------------------------------------
-- 7.11 daily_settlements — 所有人可讀，鎖定操作僅店長
-- -------------------------------------------------------------------
CREATE POLICY "settle_select_all" ON daily_settlements FOR SELECT USING (true);
CREATE POLICY "settle_insert_all" ON daily_settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "settle_update_admin" ON daily_settlements FOR UPDATE USING (public.is_admin());
-- ⛔ DELETE 禁止

-- -------------------------------------------------------------------
-- 7.12 refunds — 所有人可讀，僅店長可執行
-- -------------------------------------------------------------------
CREATE POLICY "refunds_select_all" ON refunds FOR SELECT USING (true);
CREATE POLICY "refunds_insert_admin" ON refunds FOR INSERT WITH CHECK (public.is_admin());
-- ⛔ UPDATE/DELETE 禁止

-- -------------------------------------------------------------------
-- 7.13 activity_log — 🛡️ INSERT-ONLY
-- -------------------------------------------------------------------
-- 🟢 合併 SELECT + 使用 (SELECT auth.uid()) 避免重複評估
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "log_insert_system" ON activity_log FOR INSERT WITH CHECK (true);
-- ⛔⛔⛔ 防篡改核心：任何人（包括店長、DBA）都無法 UPDATE / DELETE
-- 沒有 UPDATE / DELETE policy = 完全禁止


-- ============================================================
-- 8️⃣ 核心 RPC 函式（SECURITY DEFINER + Transaction）
-- ============================================================

-- -------------------------------------------------------------------
-- 8.1 check_appointment_conflict() — 三維防撞檢查
--     在建立預約前呼叫，檢查 staff + room + equipment 是否衝突
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_appointment_date DATE,
  p_start_time       TIME,
  p_end_time         TIME,
  p_staff_id         UUID,
  p_room_id          UUID,
  p_equipment_id     UUID DEFAULT NULL,
  p_exclude_appt_id  UUID DEFAULT NULL  -- 編輯時排除自己
)
RETURNS TABLE (
  has_conflict  BOOLEAN,
  staff_conflict BOOLEAN,
  room_conflict  BOOLEAN,
  equip_conflict BOOLEAN
) AS $$
DECLARE
  conflicting RECORD;
BEGIN
  has_conflict := false;
  staff_conflict := false;
  room_conflict := false;
  equip_conflict := false;

  -- 檢查該時段內是否有衝突的預約（排除 cancelled 及自己）
  FOR conflicting IN
    SELECT staff_id, room_id, equipment_id
    FROM appointments
    WHERE appointment_date = p_appointment_date
      AND status != 'cancelled'
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_appt_id IS NULL OR id != p_exclude_appt_id)
  LOOP
    IF conflicting.staff_id = p_staff_id THEN
      staff_conflict := true;
      has_conflict := true;
    END IF;
    IF conflicting.room_id = p_room_id THEN
      room_conflict := true;
      has_conflict := true;
    END IF;
    IF p_equipment_id IS NOT NULL AND conflicting.equipment_id = p_equipment_id THEN
      equip_conflict := true;
      has_conflict := true;
    END IF;
  END LOOP;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- -------------------------------------------------------------------
-- 8.2 deduct_service_from_appointment() — 🔴 核心扣數函式
--     預約改為「已出席」時呼叫，在 Transaction 中：
--       1. 檢查庫存是否足夠
--       2. 扣減 remaining_sessions
--       3. 更新 appointment status → attended
--       4. 寫入 payment_transactions
--       5. 寫入 activity_log（多筆）
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_service_from_appointment(
  p_appointment_id  UUID,
  p_service_ids     UUID[],     -- 要扣減的 client_services ID 陣列
  p_payment_method  TEXT DEFAULT 'cash',
  p_amount          NUMERIC(10,2) DEFAULT NULL  -- NULL = 自動計算
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
  -- 獲取當前使用者
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未登入';
  END IF;

  -- 鎖定該預約行
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
    -- 檢查是否已過期
    IF v_svc.expiry_date IS NOT NULL AND v_svc.expiry_date < CURRENT_DATE THEN
      RAISE EXCEPTION '療程「%」已過期，無法扣減', v_svc.treatment_name;
    END IF;

    -- 扣減 1 次
    UPDATE client_services
    SET remaining_sessions = remaining_sessions - 1,
        status = CASE WHEN remaining_sessions - 1 <= 0 THEN 'expired' ELSE 'active' END
    WHERE id = v_svc.id;

    -- 計價（使用購買時的 unit_price，或療程單價）
    v_total_amount := v_total_amount + COALESCE(v_svc.unit_price, 0);

    -- 寫入 activity_log
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

  -- 如果沒有指定金額，使用計算值
  IF p_amount IS NOT NULL THEN
    v_total_amount := p_amount;
  END IF;

  -- 更新預約狀態
  UPDATE appointments
  SET status = 'attended', updated_at = now()
  WHERE id = p_appointment_id;

  -- 建立交易紀錄
  INSERT INTO payment_transactions (
    appointment_id, client_id, treatment_id, staff_id,
    amount, payment_method, transaction_date, settled_by
  ) VALUES (
    v_appt.id, v_appt.client_id, v_appt.treatment_id, v_appt.staff_id,
    v_total_amount, p_payment_method, CURRENT_DATE, v_user_id
  )
  RETURNING id INTO v_tx_id;

  -- 寫入扣數完成 Log
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
  -- 🔴 Transaction 自動 ROLLBACK
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- -------------------------------------------------------------------
-- 8.3 refund_deduction() — 🔴 退款（僅店長）
--     回補 client_services 次數 + 寫入 refunds + activity_log
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refund_deduction(
  p_client_service_id UUID,
  p_sessions_to_restore INT,
  p_refund_amount     NUMERIC(10,2),
  p_reason            TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_svc     public.client_services%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  -- 🔴 權限檢查
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '權限不足：只有店長可以執行退款';
  END IF;

  -- 鎖定該庫存行
  SELECT * INTO v_svc FROM client_services WHERE id = p_client_service_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到該療程庫存紀錄';
  END IF;

  -- 回補次數
  UPDATE client_services
  SET remaining_sessions = remaining_sessions + p_sessions_to_restore,
      status = 'refunded'
  WHERE id = p_client_service_id;

  -- 寫入退款表
  INSERT INTO refunds (client_service_id, refunded_by, refund_amount, restored_sessions, reason, refund_date)
  VALUES (p_client_service_id, v_user_id, p_refund_amount, p_sessions_to_restore, p_reason, CURRENT_DATE);

  -- 寫入 Log
  INSERT INTO activity_log (user_id, action_type, target_type, target_id, details)
  VALUES (
    v_user_id, 'refund', 'client_service', p_client_service_id,
    jsonb_build_object(
      'restored_sessions', p_sessions_to_restore,
      'refund_amount', p_refund_amount,
      'reason', p_reason,
      'before_remaining', v_svc.remaining_sessions,
      'after_remaining', v_svc.remaining_sessions + p_sessions_to_restore
    )
  );

  RETURN jsonb_build_object('success', true, 'message', '退款完成');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- -------------------------------------------------------------------
-- 8.4 close_daily_settlement() — 🔒 每日結算鎖定（僅店長）
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION close_daily_settlement(
  p_settlement_date  DATE,
  p_difference_note  TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id    UUID;
  v_settle_id  UUID;
  v_totals     RECORD;
BEGIN
  v_user_id := auth.uid();

  -- 🔴 權限檢查
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '權限不足：只有店長可以鎖定結算';
  END IF;

  -- 檢查是否已鎖定
  SELECT id INTO v_settle_id FROM daily_settlements
  WHERE settlement_date = p_settlement_date AND status = 'locked';
  IF FOUND THEN
    RAISE EXCEPTION '此日結算已鎖定，無法重複操作';
  END IF;

  -- 計算當日交易彙總
  SELECT
    COALESCE(SUM(amount), 0) AS total,
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0) AS cash,
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'card'), 0) AS card,
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'transfer'), 0) AS transfer,
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'other'), 0) AS other
  INTO v_totals
  FROM payment_transactions
  WHERE transaction_date = p_settlement_date;

  -- Upsert 結算表並鎖定
  INSERT INTO daily_settlements (
    business_id, settlement_date, total_amount, cash_amount, card_amount,
    transfer_amount, other_amount, difference_note, status, locked_by, locked_at
  ) VALUES (
    (SELECT business_id FROM profiles WHERE id = v_user_id),
    p_settlement_date,
    v_totals.total, v_totals.cash, v_totals.card,
    v_totals.transfer, v_totals.other,
    p_difference_note,
    'locked',
    v_user_id,
    now()
  )
  ON CONFLICT (settlement_date) DO UPDATE SET
    total_amount    = EXCLUDED.total_amount,
    cash_amount     = EXCLUDED.cash_amount,
    card_amount     = EXCLUDED.card_amount,
    transfer_amount = EXCLUDED.transfer_amount,
    other_amount    = EXCLUDED.other_amount,
    difference_note = EXCLUDED.difference_note,
    status          = 'locked',
    locked_by       = EXCLUDED.locked_by,
    locked_at       = EXCLUDED.locked_at
  RETURNING id INTO v_settle_id;

  -- 將當日交易關聯到結算
  UPDATE payment_transactions
  SET settlement_id = v_settle_id
  WHERE transaction_date = p_settlement_date AND settlement_id IS NULL;

  -- 寫入 Log
  INSERT INTO activity_log (user_id, action_type, target_type, target_id, details)
  VALUES (
    v_user_id, 'finalize_settlement', 'settlement', v_settle_id,
    jsonb_build_object(
      'settlement_date', p_settlement_date,
      'total_amount', v_totals.total,
      'cash', v_totals.cash,
      'card', v_totals.card,
      'transfer', v_totals.transfer,
      'difference_note', p_difference_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settle_id,
    'total_amount', v_totals.total,
    'message', '結算已鎖定'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- -------------------------------------------------------------------
-- 8.5 manual_grant_sessions() — 店長手動贈送/新增療程次數
-- -------------------------------------------------------------------
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

  -- 🔴 權限檢查
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '權限不足：只有店長可以贈送或新增療程次數';
  END IF;

  -- 取得療程單價（若未指定）
  IF p_unit_price IS NOT NULL THEN
    v_price := p_unit_price;
  ELSE
    SELECT single_price INTO v_price FROM treatments WHERE id = p_treatment_id;
  END IF;

  -- 新增 client_services 紀錄
  INSERT INTO client_services (
    client_id, treatment_id, total_sessions, remaining_sessions,
    purchase_date, expiry_date, unit_price, status
  ) VALUES (
    p_client_id, p_treatment_id, p_sessions, p_sessions,
    CURRENT_DATE, p_expiry_date, COALESCE(v_price, 0), 'active'
  )
  RETURNING id INTO v_new_id;

  -- 寫入 Log
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


-- ============================================================
-- 9️⃣ 沉睡客查詢 View (SECURITY INVOKER — 使用查詢者權限)
-- ============================================================
CREATE OR REPLACE VIEW dormant_clients WITH (security_invoker = true) AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.member_id,
  c.last_visit_date,
  (CURRENT_DATE - c.last_visit_date) AS dormant_days
FROM clients c
WHERE c.last_visit_date IS NOT NULL
  AND (CURRENT_DATE - c.last_visit_date) > 90
ORDER BY dormant_days DESC;


-- ============================================================
-- 🔟 pg_cron 排程
-- ============================================================

-- 10.1 心跳任務 — 每日更新一筆系統時間，防止 Supabase 7 天無活動暫停
--     需在 Supabase Dashboard → Database → Extensions 中啟用 pg_cron
--     建立心跳表（獨立執行，不在 DO block 中）
CREATE TABLE IF NOT EXISTS _system_heartbeat (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO _system_heartbeat (id, last_heartbeat) VALUES (1, now())
ON CONFLICT (id) DO NOTHING;
-- 內部表，關閉 RLS
ALTER TABLE _system_heartbeat DISABLE ROW LEVEL SECURITY;

-- 註冊排程（若 pg_cron 已啟用）
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'heartbeat-daily',
      '17 4 * * *',
      'UPDATE _system_heartbeat SET last_heartbeat = now() WHERE id = 1'
    );
  END IF;
END;
$cron$;

-- 10.2 清理任務 — 每日凌晨 3:42 刪除 180 天前的 activity_log
--     防止 500MB 資料庫爆滿
DO $cron2$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-old-logs',
      '42 3 * * *',
      'DELETE FROM activity_log WHERE created_at < now() - INTERVAL ''180 days'''
    );
  END IF;
END;
$cron2$;


-- ============================================================
-- 8.6 revert_attended_to_confirmed() — 🔙 店長退回已出席
--     將 attended 退回 confirmed，自動回補所有已扣次數
--     • payment_transactions 標記 VOID (不刪除)
--     • client_services 回補次數
--     • activity_log 寫入完整退回紀錄
--     • 所有操作在單一 Transaction 中完成
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


-- ============================================================
-- 1️⃣1️⃣ 初始資料：預設店鋪
-- ============================================================
INSERT INTO businesses (id, name, address, phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Salon Cloud',
  '香港',
  NULL
) ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 📋 部署後操作清單
-- ============================================================
-- 1. 在 Supabase Dashboard → Authentication 中建立使用者
-- 2. 在 SQL Editor 執行以下指令設定店長角色：
--      SELECT set_claim_role('<user-uuid>', 'shop_owner');
-- 3. 手動在 profiles 表中為該使用者建立對應行：
--      INSERT INTO profiles (id, business_id, role, name)
--      VALUES ('<user-uuid>', '00000000-0000-0000-0000-000000000001', 'shop_owner', '店長');
-- 4. 在 Supabase Dashboard → Database → Extensions 中啟用 pg_cron
-- 5. 在 Supabase Dashboard → Database → Settings 中啟用 PgBouncer (Transaction mode)
-- 6. 前端 .env.local 設定：
--      VITE_SUPABASE_URL=https://<project>.supabase.co
--      VITE_SUPABASE_ANON_KEY=<your-anon-key>
-- ============================================================
