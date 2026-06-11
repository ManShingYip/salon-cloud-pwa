# AI 接手任務書 v2.0

> **新 AI 請先讀呢份** — 包含完整專案背景、設計理念、已完成項目、待辦任務
> 其他 docx 檔案係補充參考

---

## 1. 專案概覽

美容院雲端管理系統（PWA），俾美容院店長喺 iPad 上管理客戶、療程、預約、收錢。

| 項目 | 詳情 |
|------|------|
| **前端** | React (Vite) + Tailwind CSS + Flowbite React |
| **後端** | Supabase (PostgreSQL + Auth + RLS + RPC) |
| **部署** | Vercel → https://salon-cloud-pwa.vercel.app |
| **Repo** | https://github.com/ManShingYip/salon-cloud-pwa |
| **裝置** | iPad 橫向 1024×768，觸控操作 |

---

## 2. 核心設計理念（必須理解）

### 角色定位
呢個係**店長端**，唔係客戶端。所有操作係「店長記錄」。
- ✅ **收錢**（唔係「支付」）
- ✅ **消耗次數**（唔係「扣減」）
- ✅ **訂單** = client_service（唔係死板套餐）

### 緩存 (Buffer) 概念
未完全完成 = 緩存：
- 做完服務但未收足錢 → 緩存
- 收咗錢但未做完服務 → 緩存
- 只有**做晒所有次數 + 收足全額** = 確定收入

### 訂單 (Order) 為本
- treatments = 餐單（預設價格、時長）
- client_services = 落單訂單（可自由調整金錢同次數）
- 收入紀錄 = 訂單交易列表（唔係會計帳）

### 自由輸入原則
所有數字（收幾多錢、退幾多錢、消耗幾多次）由店長自由輸入，系統唔自動計算。

---

## 3. 用詞規範（嚴格）

| ❌ 禁用 | ✅ 使用 |
|------|------|
| 扣減 / 扣數 | 消耗次數 / 收錢 |
| 支付 | 收錢 |
| 每日結算 / 今日收入 | 收入紀錄 / 緩存概覽 |
| DeductionModal / Deduction | PaymentModal / Payment |
| 手動扣減 | 收錢 |

---

## 4. 頁面架構

| 頁面 | 路由 | 檔案 | 誰見 |
|------|------|------|------|
| 儀表板 | `/` | DashboardPage.jsx | 所有人 |
| 今日預約 | `/appointments` | DailyAppointmentsPage.jsx | 所有人 |
| 新增預約 | `/appointments/new` | NewAppointmentPage.jsx | 所有人 |
| 客戶管理 | `/clients` | ClientListPage.jsx | 所有人 |
| 客戶詳情 | `/clients/:id` | ClientDetailPage.jsx | 所有人 |
| 療程管理 | `/treatments` | TreatmentManagePage.jsx | 店長 |
| 收入紀錄 | `/settlement` | DailySettlementPage.jsx | 所有人 |
| 員工排班 | `/schedules` | StaffSchedulePage.jsx | 店長 |
| 活動日誌 | `/logs` | ActivityLogPage.jsx | 店長 |
| 沉睡客戶 | `/dormant` | DormantClientsPage.jsx | 店長 |

---

## 5. 已完成項目

- ✅ 客戶 CRUD + 搜尋（電話後四碼 + 會員編號）+ 敏感標記
- ✅ 療程管理 + 三層防禦停用（顯示誰在用）
- ✅ 預約全流程（建立 + 三維防撞 + 日期選擇）
- ✅ PaymentModal（Appointment 模式 + Manual 模式）+ 收錢+消耗次數+找續
- ✅ 退款（自由輸入金額 + 退款方式）+ 購買記錄收入
- ✅ 活動日誌（INSERT-ONLY）+ 沉睡客 + WhatsApp 提醒
- ✅ 員工排班 + Excel 匯出 + PWA
- ✅ 全部改用原生 `<table>`（Flowbite Table 有 Safari shadow bug）
- ✅ AppLayout `overflow-hidden` + sticky thead `z-0`

---

## 6. 🔴 待辦任務（按優先順序）

### 任務 1：收入紀錄頁面重做
**檔案**：`src/pages/DailySettlementPage.jsx`

**目標**：改為三區塊佈局：
1. **篩選列**：日期範圍 + 客戶搜尋 + 狀態下拉（全部/緩存/確定/已退款）+ 收款方式
2. **頂部雙框架卡**：🟡 緩存中（筆數+待收金額）並排 🟢 確定收入（筆數+已收金額），點擊可 filter 下方 list
3. **下方一單一記錄 List**：
   - 每行 = 一筆 payment_transactions（收錢動作）
   - 顯示：客戶、療程、已收/總額、進度 bar、收款方式、日期、🟡/🟢 標記
   - 分期付款顯示 `$1,500/$5,000 ███░░░░ 30%`
   - 已完成顯示 `$380/$380 ██████ 100%` + 綠色標記
4. **底部收款方式統計**

**設計參考**：[收入紀錄設計.md](收入紀錄設計.md)

### 任務 2：Dashboard 緩存化
**檔案**：`src/pages/DashboardPage.jsx`

- 刪除「今日收入」區塊
- 改為「緩存概覽 + 確定收入」（兩個 summary 卡）
- 從 client_services 查詢緩存中訂單數

### 任務 3：client_services 加 total_price
- DB migration：`ALTER TABLE client_services ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2)`
- 購買時計算 total_price = unit_price × total_sessions
- PaymentModal 顯示「已收/總額」進度
- ClientDetailPage 療程卡片顯示緩存狀態

### 任務 4：員工排班頁面
**檔案**：`src/pages/StaffSchedulePage.jsx`

已實作但待確認喺 iPad 上顯示正常。

### 任務 5：DailyAppointmentsPage 收錢 Modal 測試
**檔案**：`src/pages/DailyAppointmentsPage.jsx`

PaymentModal appointment 模式需要實機測試（confirmed → 按收錢 → Modal 彈出 → 多選服務 → 確認收錢）。

---

## 7. 技術要點

### 表格
```jsx
// ✅ 原生 <table>，不用 Flowbite <Table>
<table className="w-full text-left text-sm">
  <thead className="sticky top-0 z-0">
    <tr className="bg-bg text-xs uppercase text-text-muted border-b">
      <th className="px-6 py-4 font-bold">...</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-100">
    {data.map(row => <tr key={row.id}>...</tr>)}
  </tbody>
</table>
```

### 佈局
```jsx
// AppLayout <main> — 鎖死高度，禁止全頁滾動
<main className="flex-1 flex flex-col overflow-hidden relative p-6 transform-gpu">
  <div className="flex-1 min-h-0"><Outlet /></div>
</main>

// 子頁面 — 各自內部 overflow
<div className="flex-1 flex flex-col min-h-0 space-y-4">
  <header className="shrink-0">...</header>
  <div className="flex-1 min-h-0 overflow-auto">
    <table>...</table>
  </div>
</div>
```

### 資料查詢
```jsx
import { supabase } from '@/config/supabase'

// 基本 pattern
const { data } = await supabase.from('table').select('*, join_table(name)').eq('field', value)
```

### 部署
```bash
npm run build
npx vercel deploy --prod --yes
git add -A && git commit -m "..." && git push
```

---

## 8. 資料庫核心表

| 表 | 用途 |
|------|------|
| clients | 客戶 |
| treatments | 療程餐單 |
| client_services | **訂單**（總額、已收、剩餘次數）|
| appointments | 預約 |
| payment_transactions | 每次收錢記錄 |
| refunds | 退款記錄 |
| activity_log | INSERT-ONLY 日誌 |
| profiles | 使用者 |

---

## 9. 相關文檔

| 文檔 | 用途 |
|------|------|
| **AI-接手任務書 v2.md** | 本文件 — 先讀呢份 |
| 美容院管理 App 功能規格書.md | 完整需求（v2 已更新） |
| 收入紀錄設計.md | 收入紀錄頁面詳細設計 |
| 店長儀表板 Dashboard 設計.md | Dashboard v2 緩存模式 |
| 前端 UI/Google Stitch 製造頁面任務.md | 頁面佈局示意圖 |
| 資料庫 ERD.md | ER 圖 |
| 完整 Supabase Schema SQL.sql | DB Schema + RPC |
