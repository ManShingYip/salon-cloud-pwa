# 美容院管理系統 — 完整 Use Case 分析 vs 實作現況

> 對比來源：[美容院管理 App 功能規格書.md](美容院管理 App 功能規格書.md)
> 最後更新：2026-06-11（經實際測試 `salon-cloud-pwa.vercel.app` 核實）

---

## 📊 功能完整度矩陣（2026-06-11 實測版）

### 🔐 認證與權限

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_AUTH_01 | 登入 / 登出 | ✅ LoginPage.jsx + AppLayout | ✅ Supabase Auth | ✅ 完成 |
| UC_AUTH_02 | JWT 角色驗證 | ✅ AuthContext.isOwner/isStaff | ✅ public.user_role() + RLS | ✅ 完成 |
| UC_AUTH_03 | 店長設定員工角色 | 🔴 僅 SQL | ✅ set_claim_role() | 🔴 無管理介面（低優先） |

### 👥 客戶管理

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_CLI_01 | 新增客戶 | ✅ ClientListPage Modal | ✅ INSERT RLS | ✅ 完成 |
| UC_CLI_02 | 編輯客戶資料 | ✅ ClientDetailPage Modal（含敏感標記） | ✅ UPDATE RLS | ✅ 完成 |
| UC_CLI_03 | 搜尋客戶 (電話後四碼/姓名) | ✅ ClientListPage | ✅ clients 表 | ✅ 完成 |
| UC_CLI_04 | 設定客戶來源標籤 | ✅ 新增/編輯客戶 Modal 含 source | ✅ clients.source | ✅ 完成 |
| UC_CLI_05 | 標記特殊敏感客戶 | ✅ 編輯客戶 Modal 含 is_sensitive + sensitive_note | ✅ clients.is_sensitive | ✅ 完成 |
| UC_CLI_06 | 查看客戶詳情 | ✅ ClientDetailPage（資訊+庫存+歷史） | ✅ | ✅ 完成 |
| UC_CLI_07 | 敏感客戶 Popup 警示 | ✅ DailyAppointmentsPage 敏感 Popup + ClientDetail 顯示 | ✅ | ✅ 完成 |
| UC_CLI_08 | 客戶列表總覽 | ✅ ClientListPage（搜尋+列表+新增） | ✅ SELECT RLS | ✅ 完成 |
| UC_CLI_09 | 刪除客戶 (僅店長) | 🔴 無 UI | ✅ DELETE RLS 僅店長 | 🔴 低優先 |

### 💆 療程管理

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_TRT_01 | 建立療程 | ✅ TreatmentManagePage Modal + business_id | ✅ INSERT RLS | ✅ 完成 |
| UC_TRT_02 | 編輯療程 | ✅ 同上 | ✅ UPDATE RLS | ✅ 完成 |
| UC_TRT_03 | 停用療程 | ✅ 附刪除確認 Modal | ✅ is_active=false | ✅ 完成 |
| UC_TRT_04 | 查看療程列表 | ✅ TreatmentManagePage | ✅ | ✅ 完成 |
| UC_TRT_05 | 客戶購買療程 | ✅ ClientDetailPage「新增購買」Modal | ✅ manual_grant_sessions() | ✅ 完成 |
| UC_TRT_06 | 手動贈送次數 | ✅ ClientDetailPage「購買療程」Modal | ✅ manual_grant_sessions() | ✅ 完成 |
| UC_TRT_07 | 客戶療程庫存 | ✅ ClientDetailPage 右側卡片 | ✅ client_services | ✅ 完成 |

### 📅 預約管理 (三維防撞)

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_BK_01 | 建立預約 | ✅ NewAppointmentPage 三步驟表單 | ✅ appointments INSERT | ✅ 完成 |
| UC_BK_02 | 修改預約 | ✅ EditAppointmentPage（時間/美容師/房間）| ✅ appointments UPDATE | ✅ 完成 |
| UC_BK_03 | 取消預約 | ✅ DailyAppointmentsPage「取消」按鈕 | ✅ status='cancelled' | ✅ 完成 |
| UC_BK_04 | 改為「已出席」| ✅ 點擊「扣數」按鈕 → DeductionModal | ✅ deduct RPC | ✅ 完成 |
| UC_BK_05 | 改為「失約」| 🔴 無獨立按鈕 | 🔴 只能手動改 status | 🔴 低優先 |
| UC_BK_06 | 今日預約總覽 | ✅ DailyAppointmentsPage（日曆+時間線+統計） | ✅ | ✅ 完成 |
| UC_BK_07 | 三維防撞檢查 | ✅ checkConflicts() 即時顯示 | ✅ check_appointment_conflict() | ✅ 完成 |
| UC_BK_08 | 失約 2 次警告 | ✅ 預約卡片顯示 `⚠️ 失約 N 次` Tag | ✅ no_show_count Trigger | ✅ 完成 |
| UC_BK_09 | 員工排班設定 | ✅ StaffSchedulePage 7 天網格編輯 | ✅ staff_schedules 表 | ✅ 完成 |
| UC_BK_10 | 非辦公時段隱藏 | 🔴 無 | 🔴 | 🔴 日後再加 |

### ✂️ 扣數與防呆

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_DED_01 | 自動彈出扣數確認單 | ✅ handleStatusChange() | ✅ | ✅ 完成 |
| UC_DED_02 | 手動勾選扣減項目 | ✅ DeductionModal Checkbox | ✅ | ✅ 完成 |
| UC_DED_03 | 禁全自動盲目扣減 | ✅ 多選 + 員工手選確認 | ✅ RPC 強制檢查 | ✅ 完成 |
| UC_DED_04 | 一次勾選多個 | ✅ Checkbox 多選 | ✅ p_service_ids[] | ✅ 完成 |
| UC_DED_05 | Transaction 原子扣數 | ✅ | ✅ deduct_service_from_appointment | ✅ 完成 |

### 💰 每日結算

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_STL_01 | 當日收入總覽 | ✅ DailySettlementPage | ✅ | ✅ 完成 |
| UC_STL_02 | 支付方式分類 | ✅ 現金/信用卡/轉賬卡片 | ✅ | ✅ 完成 |
| UC_STL_03 | 備註差異輸入 | ✅ Textarea | ✅ | ✅ 完成 |
| UC_STL_04 | 鎖定結算二次確認 | ✅ 二次確認 Modal | ✅ close_daily_settlement() | ✅ 完成 |
| UC_STL_05 | 交易明細 | ✅ Table | ✅ | ✅ 完成 |

### 🔄 退款與過期

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_REF_01 | 退款 (回補次數) | ✅ ClientDetailPage 退款 Modal | ✅ refund_deduction() | ✅ 完成 |
| UC_REF_02 | 套票過期處理 | 🔴 無獨立 UI（RPC 自動標記 expired） | 🟡 client_services.status='expired' | 🟡 自動化，日後可加強 |
| UC_REF_03 | 退款原因必填 | ✅ Modal 內 reason TextInput 必填 | ✅ reason NOT NULL | ✅ 完成 |
| UC_REF_04 | 自動扣減當日收入 | 🟡 refund 寫入 refunds 表 | ✅ refund_deduction() 內寫 Log | 🟡 部分（不直接影響 settlement） |
| UC_REF_05 | 不可刪改 Log | ✅ activity_log INSERT-ONLY | ✅ RLS 無 UPDATE/DELETE | ✅ 完成 |

### 📋 系統日誌

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_LOG_01 | 自動記錄關鍵操作 | ✅ 所有 RPC 內自動寫 Log | ✅ RPC + Trigger | ✅ 完成 |
| UC_LOG_02 | 店長查看日誌 | ✅ ActivityLogPage（搜尋+篩選+中文標籤） | ✅ log_select policy | ✅ 完成 |
| UC_LOG_03 | 員工看自己紀錄 | ✅ 同一頁面，RLS 自動過濾 | ✅ user_id = auth.uid() | ✅ 完成 |
| UC_LOG_04 | INSERT-ONLY | ✅ 前端無編輯/刪除按鈕 | ✅ RLS 無 UPDATE/DELETE | ✅ 完成 |

### 😴 沉睡客

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_DOR_01 | 90天無預約篩選 | ✅ DormantClientsPage（清單+沉睡天數+WhatsApp） | ✅ dormant_clients View | ✅ 完成 |

### 📤 資料匯出

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_EXP_01 | 匯出客戶名單 Excel | ✅ DashboardPage「匯出客戶名單」按鈕 | ✅ exportExcel.js | ✅ 完成 |
| UC_EXP_02 | 匯出銷售紀錄 Excel | ✅ DashboardPage「匯出銷售紀錄」按鈕 | ✅ exportExcel.js | ✅ 完成 |

### ⚙️ 系統維護

| # | Use Case | 前端 | API/SQL | 狀態 |
|---|----------|------|---------|------|
| UC_ADM_01 | Supabase Dashboard | N/A（開發者直接操作） | ✅ | ✅ |
| UC_ADM_02 | 資料備份 | N/A | 🟡 手動 pg_dump | 🟡 |
| UC_ADM_03 | pg_cron 排程 | N/A 自動執行 | ✅ heartbeat + cleanup | ✅ 完成 |
| UC_ADM_04 | 安全三修 | N/A | ✅ 結算鎖定+FOR UPDATE+停用標示 | ✅ 完成 |

---

## 📈 統計

| 狀態 | 數量 | 說明 |
|------|------|------|
| ✅ 完成 | 42 | 登入、客戶 CRUD、療程 CRUD、預約全流程、扣數、退款、結算、日誌、沉睡客、排班、匯出、三方防撞、安全三修 |
| 🟡 部分 | 4 | 失約獨立按鈕、非辦公時段、套票過期手動 UI、退款不直接連結算 |
| 🔴 未實作 | 4 | 店長設定員工角色 UI、刪除客戶 UI、UC_BK_05 失約獨立按鈕、UC_BK_10 排班時段過濾 |

---

## ✅ 規格書三大原則達成狀況

| 原則 | 達成 | 說明 |
|------|------|------|
| 零成本 | ✅ | Vercel Free + Supabase Free + GitHub Free，每月 HK$0 |
| 防員工走漏洞 | ✅ | INSERT-ONLY Log、RLS、SECURITY DEFINER RPC 內權限檢查、結算鎖定、冪等防連擊 |
| iPad 可用性 | ✅ | Tailwind 響應式、48px 最小點擊區、PWA manifest + icon |

---

## 🟡 已知可日後再加

1. **店長設定員工角色 UI** — 目前用 `set_claim_role()` SQL，低頻率操作可接受
2. **刪除客戶 UI** — RLS 已保護僅店長可刪，缺少前端按鈕但不影響日常
3. **失約獨立按鈕** — 目前可透過手動改 status='no_show' 達成
4. **非辦公時段自動過濾** — 排班表已可設定，但新增預約時未連動過濾可用時段
5. **PWA 離線緩存** — sw.js 已部署，但未設定精細的離線策略

---

## 🛡️ 安全修復記錄

| 修復 | RPC | 說明 |
|------|-----|------|
| 🔴 漏洞一 | deduct_service_from_appointment | 結算鎖定後禁止扣數 |
| 🔴 漏洞一 | revert_attended_to_confirmed | 結算鎖定後禁止退回 |
| 🔴 漏洞二 | revert_attended_to_confirmed | FOR UPDATE + 狀態檢查防連擊 |
| 🔴 漏洞三 | DeductionModal | 停用療程顯示 (已停用) 標示 |

---

## 🔐 IT 管理員角色澄清

規格書中提到的「IT 管理員」是指 **Supabase Dashboard 的直接存取權**（開發者），不是在 App 內登入的角色。App 內只有兩個角色：
- `shop_owner`（店長）— 全功能，包括查看完整 activity_log
- `staff`（美容師）— 僅能查看自己相關的操作紀錄

activity_log 的 RLS 為：
```sql
CREATE POLICY "log_select" ON activity_log FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
```

即：員工看自己的操作、店長看全部。沒有任何 App 內使用者可以修改或刪除 log（INSERT-ONLY）。
