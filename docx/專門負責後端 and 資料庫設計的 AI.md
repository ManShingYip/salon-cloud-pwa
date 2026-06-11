# 🗄️ 任務委派：後端資料庫專家 AI — Supabase 完整架構、安全防弊設計與零成本雲端部署

**委派對象**：專門負責後端 / 資料庫設計的 AI
**任務目的**：為美容院雲端管理系統設計一整套基於 **Supabase** 的 PostgreSQL 資料庫，包括所有表格、RLS 權限政策（採用 Custom Claims）、跨表事務預存程序、防篡改 Log 機制、排程清理（pg_cron）以及索引優化；同時規劃從 **Vercel 前端** 到 **Cloudflare DNS** 的完整部署方案，確保在 **2025–2026 最新免費服務限制內實現零成本穩定運行**。

---

## 📋 專案硬體環境（已確認的最新限制）

以下為目前各平台免費方案的關鍵限制（截至 2025 年 5 月，已核實），你的設計必須在這些框架內運作，且針對可能觸發的限制預先加入防護機制。

### Supabase Free Tier

- **資料庫容量**：500 MB（超過會變成唯讀）
- **每月免費 API 請求**：無上限
- **直接連線數**：約 60（**強烈建議所有應用連線一律使用內建 PgBouncer 連線池，可達 15,000 並發**）
- **Auth MAU**：50,000（足夠小型店家使用）
- **檔案儲存**：1 GB / 每月下載流量 5 GB
- **Realtime**：最多 200 同時連線、每月 200 萬則訊息（**避免長時間持有 WebSocket，僅在必要頁面連線**）
- **自訂域名**：**不支援**，API 端點將為 `https://<project>.supabase.co`
- **專案數**：最多 2 個活躍專案
- **備份**：**無自動備份**（你需要在設計中說明手動匯出或排程外連備份的策略，但無需實作，僅提供指引）
- **暫停機制**：**連續 7 天無資料庫活動 → 自動暫停**。美容院系統每天必有預約操作，預期不會觸發；但仍可建議於 `pg_cron` 加入簡單的心跳更新（如每天將一個 dummy 欄位設為 `now()`），以防萬一。

### Vercel Hobby Plan

- **頻寬**：100 GB / 月
- **Serverless Functions 執行時間**：最長 300 秒（**所有 RPC 呼叫必須小於此時間，因此觸發器內部禁止長時間計算**）
- **環境變數**：最多 1,000 個
- **每日部署次數**：100 次
- **自訂域名**：完全支援，可自動 Let's Encrypt SSL
- **PWA Service Worker**：無限制，可正常部署

### Cloudflare Free Plan

- **DNS 管理**：完全免費，無上限
- **SSL**：支援 Full (Strict) 模式（前提是目標具備有效 SSL，Vercel 已滿足）
- **轉址規則**：免費支援（Redirect Rules）
- **Workers**：每日 100,000 請求（如有後續自建輕量 API 可選用）

### 域名方案

- **不建議使用免費域名**（`.us.kg`、`.pp.ua`、`.eu.org`）作為生產環境，因為 WhatsApp API、第三方登入等會阻擋此類後綴。
- **最小成本建議**：花費約數十元港幣註冊一個 `.com` / `.net`（超出零目標，但此為正式營業強烈推薦，任務書中你可以標記為「可選」）。
- **零成本階段**：可直接使用 Vercel 提供的 `your-app.vercel.app`，但必須在文件標註日後若需 WhatsApp 商務 API 或第三方金流，要再綁定自有域名。

---

## 🛡️ 核心安全原則

1. **權限模型（多角色）**

   - 角色：`shop_owner`（店長）、`staff`（一般美容師）
   - **嚴禁使用 `raw_user_meta_data` 儲存角色！** 因為前端可透過 `updateUser()` 自行篡改。
   - **必須採用 Custom Claims**（官方推薦延伸套件 `supabase-custom-claims` 或手動經由 `service_role` 寫入 JWT Claims）。
   - 建立一個 `auth.is_admin()` 的 SECURITY DEFINER 函式，讓所有 RLS 政策呼叫此函式判斷角色，避免重複邏輯。
2. **防篡改 Log 表**

   - 所有變動（扣數、退款、預約狀態變更）都必須寫入一張 `activity_log` 表。
   - 該表 RLS 政策：
     - `INSERT`：允許經過驗證的使用者（或僅限觸發器寫入）。
     - `UPDATE` / `DELETE`：**USING (false)**，任何人（包括店長）都無法修改或刪除已產生的日誌。
3. **跨表事務一致性**

   - 扣減療程次數 + 寫入 Log **必須在同一筆 Database Function（RPC）內**執行，並使用 `BEGIN ... COMMIT`，確保中途失敗時自動回滾，避免只扣次數未寫 Log 的災難。
4. **資料庫觸發器**

   - 可使用觸發器確保資料完整性（例如自動更新客戶最後來店時間），但**觸發器內部僅能做輕量操作**，不可發送 HTTP 請求或繁重運算，否則會鎖住當前事務導致 API 逾時。

---

## 🗃️ 你需要交付的資料庫設計

### 1. 完整資料表結構（SQL CREATE TABLE）

請依照以下需求產出所有表格定義，標示清楚資料型別、主鍵、外鍵、預設值、NOT NULL 約束，並使用 `UUID` 作為主鍵以利日後擴展。

核心表格（必須包含，但不限於以下）：

- `profiles`：關聯 `auth.users`，儲存該使用者的店鋪角色（shop_owner / staff）、姓名、電話、狀態。
- `clients`：客戶資料（姓名、電話、標籤 JSON 或關聯表、來源、備註、屬於哪個店鋪）。為支持多店鋪（日後擴充），加入 `business_id` 概念，目前預設全部屬於同一店家即可。
- `services`：療程（名稱、單價、所需時間分鐘數、是否有效）。
- `rooms`：房間（名稱、容量、可供使用的設備關聯）。
- `equipment`：儀器（名稱、可用數量）。
- `appointments`：預約核心表（關聯客戶、美容師、療程、房間、儀器、開始時間、結束時間、狀態：已預約/已出席/已取消/失約）。
- `client_services`：客戶已購療程庫存（療程、總次數、剩餘次數、購買日期、過期日、狀態）。
- `deductions`：扣數紀錄（關聯預約、療程、扣減次數），但這部分可合併到 `activity_log`。
- `activity_log`：通用日誌表，記錄所有變動（類型、目標 ID、操作人、變動前後資料 JSONB、建立時間）。
- `payment_transactions`：結帳紀錄（關聯預約、金額、支付方式、備註、結算人員、結算時間）。
- `daily_settlements`：每日結算板（日期、店長確認狀態、備用金差異、備註）。

**注意**：每張表都必須加上 `created_at`、`updated_at`（除 Log 表外），並設計合適的索引（請寫出 CREATE INDEX 語句）。

### 2. 完整 RLS 政策

對於每張表，寫出你的 RLS 策略（ALTER TABLE ... ENABLE ROW LEVEL SECURITY 及 CREATE POLICY ...）。規則簡述：

- **profiles**：使用者只能讀取自己的資料；店長可讀取同店鋪所有人。
- **appointments**：美容師只能看到自己相關的預約（自己服務的或全店的視需求，請評估）；店長可看全部。美容師可建立預約、修改預約狀態（但退款等操作僅店長）。
- **client_services**：扣數操作只能透過 Database Function 完成，不允許直接 UPDATE 剩餘次數（避免前端直接竄改）。所以 SELECT 可開放給店長及相關員工，但 UPDATE/INSERT/DELETE 必須極嚴謹控制（僅店長可手動修改？請設計）。
- **activity_log**：INSERT 僅允許透過 SECURITY DEFINER 函式執行；SELECT 店長可見，員工僅見自己活動。
- **其餘表** 依角色權限清楚定義。

### 3. 自訂 Claims 與權限函式

- 寫出一個 SQL 初始化腳本，用來幫現有用戶設定 custom claims，例如將特定 user_id 升級為 `shop_owner`。
- 建立 `auth.user_role()` 函式（SECURITY DEFINER），解析 `auth.jwt() -> 'app_metadata' -> 'role'`，回傳文字。確保它具有正確的 `search_path` 設定（`SET search_path = ''`）以防止注入。

### 4. 核心預存程序（RPC）

- **`deduct_service_from_appointment`**：當前端將預約改為「已出席」時觸發。
  - 輸入：預約 ID、要扣減的療程及對應次數（可多項）。
  - 步驟：
    1. 檢查該客戶的 `client_services` 中各療程剩餘次數是否足夠。
    2. 在一個事務中：扣減剩餘次數、更新預約狀態為 `attended`、寫入 `activity_log` 多筆紀錄（各療程扣減細節）。
    3. 若任何步驟失敗，ROLLBACK 並回傳錯誤。
  - 必須加上 `SECURITY DEFINER` 以便繞過 RLS，且內部權限驗證要自己檢查（呼叫前述 `auth.is_admin()` 或自行判斷角色，例如僅員工可執行）。
- **`refund_deduction`**：店長專用退款函式，回補剩餘次數並寫 Log。
- **`close_daily_settlement`**：結算確認，確保當日收入無法再更動。

### 5. pg_cron 排程作業

- 建立一個每小時或每天執行的清理任務（例如刪除 180 天前的 `activity_log`，以免撐爆 500 MB 資料庫）。
- 建立一個心跳任務（每日一次更新一個系統表中的時間戳），以確保專案不會因閒置 7 天被暫停（可選，但建議寫出腳本）。

### 6. 索引與效能最佳化

- 針對頻繁查詢的欄位：`appointments.start_time`、`appointments.status`、`client_services.client_id`、`activity_log.created_at` 等建立索引。
- 說明連線池設定：應在 Supabase Dashboard 啟用 PgBouncer，並將前端連線字串指定為連線池連接埠（Transaction mode），避免耗盡直接連線數。

---

## ☁️ 部署架構設計與步驟指引

請針對以下架構提供步驟式說明（文字即可，不用實作，但需清楚到任何工程師都能照做）：

```
[前端 PWA] -- 部署於 Vercel (REACT_APP_SUPABASE_URL & KEY 設為環境變數)
       |
       V
[Cloudflare DNS] -- 管理自定義域名 (如 my-salon.com) → CNAME 指向 Vercel
       |
       V
[Supabase] -- 後端 API + Auth + Database
```

1. **Vercel 部署**

   - 在 Vercel 導入 GitHub 專案，設定 Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)。
   - 確認 PWA Service Worker (`sw.js`) 已放於 `public/` 目錄且正確註冊。
   - 提醒 Vercel 會自動分配一個 `.vercel.app` 域名，若暫不買付費域名，可直接使用。
2. **Cloudflare DNS 設定（使用自有域名時）**

   - 將域名註冊商（如 Namecheap）的 Nameserver 改為 Cloudflare 提供的兩組 NS。
   - 在 Cloudflare DNS 新增 CNAME 紀錄（如 `www` → `your-app.vercel.app`），並啟用 Proxy（橘雲）。
   - SSL/TLS 模式設為 **Full (Strict)**。
   - 設定 Redirect Rules 將 root domain 重定向至 `www` 或直接使用 Vercel 的 domain 別名設定。
   - 注意：Api 部分仍指向 `xxx.supabase.co`，無需 Cloudflare 代理 Supabase。
3. **Supabase 專案初始化**

   - 建立新專案，將你交付的完整 SQL 腳本透過 Dashboard SQL Editor 執行。
   - 啟用 PgBouncer 並提供兩種連線字串（直連與池連線）給前端，提示應使用連線池字串。
   - 於 Dashboard 建立或上傳自訂 claims 的初始使用者（至少一個店長帳號）。
   - 設定 `pg_cron`：需在專案設定內啟用此擴充，然後執行你寫好的排程 SQL。
4. **長期維護與備份提醒**

   - 由於 Free Tier 無自動備份，建議每週手動匯出資料庫：Supabase Dashboard → Database → Backups → 手動下載，或利用 GitHub Actions 搭配 `pg_dump` 備份到 Cloudflare R2（此為進階選項，你在交付物中簡述方法即可）。

---

## 📦 交付物規格

請以 **單一 Markdown 文件** 交付，其中分段包含：

1. **完整 SQL 腳本**

   - 所有 CREATE TABLE、INDEX、RLS 政策、函式、觸發器、pg_cron 排程。
   - 附帶註解說明權限邏輯與防弊設計重點。
2. **部署與環境設定指引**

   - 前述 Vercel + Cloudflare + Supabase 步驟說明。
   - 提醒哪些地方需注意免費限制（如 Supabase 暫停機制、連線數、Vercel 函數逾時等）。
3. **成本與監控建議**

   - 估算維持零成本的可行性（資料庫預估佔用 < 300 MB、每月 API 請求量極低等）。
   - 建議設定 Supabase Dashboard 用量警報，接近 400 MB 或 MAU 增長時考慮升級 Pro Plan（$25/月）。
4. **注意事項與潛在風險**

   - Custom Domain 無法直接用於 Supabase API，但不影響 PWA 使用。
   - 若日後需 WhatsApp API 等第三方白名單，強烈建議購買便宜付費域名。

---

## ⚠️ 最後提醒

- **速度與防呆**：所有 RPC 必須設計為冪等（同一預約重複扣數會被阻擋），並以清晰錯誤訊息回報。
- **PWA 響應式**：後端僅提供 API，但你需要確保回傳的資料結構精簡，前端能一次取得所需資訊減少請求次數。
- **測試情境**：請在心中驗證以下流程不會出錯：
  1. 員工將預約改為已出席 → 彈窗選擇扣減 A 療程 1 次、B 療程 1 次 → 確認後 client_services 剩餘次數正確減少，activity_log 有多筆不可刪紀錄。
  2. 店長誤扣後進行退款，次數回補且 log 清楚記載退款事件。

---

請開始進行後端藍圖設計，並提供完整的交付物。如有任何規格不清或需要更明確的業務規則，請隨時提問。你的輸出將會直接交付給開發團隊進行實作，因此務必精確、可執行。
