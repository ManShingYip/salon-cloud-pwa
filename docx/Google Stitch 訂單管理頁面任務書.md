# 訂單管理頁面 — Google Stitch 任務書

> **只描述功能與數據，不干涉 UI 設計。**
> 設計由你全權決定 — 顏色、間距、排版、元件選擇。

---

## 1. 頁面目的

美容院店長每日打開呢頁，管理所有訂單。

呢頁記錄嘅係**訂單**，唔係會計帳。每一筆訂單 = 客戶買咗一個療程套餐。店長核心動作：
- 快速睇到邊張單爭錢（欠款未找數）
- 快速睇到邊張單做完未俾錢
- 快速睇到邊張單退咗款
- 快速睇到邊張單就快爛尾（高風險）
- Click 任何分類 → 下面列表即時 filter

---

## 2. 元件需求

### 2.1 頁面標題區
- 標題文字：`📋 訂單管理`
- 右上角按鈕：`匯出 Excel`

### 2.2 篩選區
全部篩選放喺同一行/區：

| 篩選項 | 類型 | 說明 |
|--------|------|------|
| 日期範圍 | 兩個 date input | 開始日期 ～ 結束日期，預設本月 |
| 經手人 | 下拉選單 | `全部` + 所有活躍 profile |
| 客戶搜尋 | 文字輸入框 | 搜尋客戶姓名 |

### 2.3 訂單狀態切換 Tabs
四個切換狀態，click 即 filter 下面 list：

| Tab | 過濾邏輯 | 顯示數字 |
|-----|----------|----------|
| **全部訂單** | 顯示所有訂單 | 總筆數 |
| **緩存中** | remaining > 0 OR paid < total_price（未完成） | 緩存筆數 |
| **已完成** | remaining = 0 AND paid >= total_price（收足+做完） | 完成筆數 |
| **已退款** | status = refunded 或有退款記錄 | 退款筆數 |

每個 Tab 上顯示對應筆數。

### 2.4 快捷分類 Chips（只喺選中 Tab 後出現）

| Tab | Chips |
|-----|-------|
| 緩存中 | 「欠款未找」n 筆 HK$X · 「未做套票」n 筆 HK$X · 「高風險 >60日」n 筆 HK$X |
| 已完成 | 「本月完成」n 筆 HK$X · 「過往累積」n 筆 HK$X |
| 已退款 | 「本月退款」n 筆 HK$X · 「過往退款」n 筆 HK$X |

Click chip → 再 filter list（幫店長快速 drill down）。

快捷分類定義：
- **欠款未找**：remaining = 0 AND paid < total_price（做完療程但未俾足錢 → 要追數）
- **未做套票**：remaining > 0（客人未做晒療程次數）
- **高風險**：欠款天數 > 60 日
- **本月完成/退款**：transaction_date / refund_date >= 今個月 1 號
- **過往完成/退款**：transaction_date / refund_date < 今個月 1 號

### 2.5 訂單列表（表格）
一個大表格顯示所有訂單記錄。**一行 = 一筆訂單（client_service）或一筆退款**。

Columns：

| Column | 資料來源 | 格式 |
|--------|----------|------|
| 客戶 | `clients.name` | 粗體 |
| 療程 | `treatments.name` | 普通文字 |
| 已收 / 總額 | `SUM(payment_transactions.amount)` / `total_price` | `$1,500 / $5,000`（退款行只顯示退款金額） |
| 剩餘次數 | `remaining_sessions` / `total_sessions` | `3 / 10 次` |
| 付款進度 | paid ÷ total_price × 100% | 百分比條 + 數字% |
| 購買日期 | `purchase_date` | `2026-06-10` |
| 最後收錢日 | 最後一筆 `payment_transactions.transaction_date` | `06-10` |
| 經手人 | `profiles.name`（settled_by） | 員工名 |
| 狀態 | 緩存中 / 已完成 / 已退款 | 狀態標籤 |

退款行特殊處理：
- 已收/總額 column 顯示 `-$800`
- 付款進度 column 顯示退款原因文字

### 2.6 篩選列右上角 Inline 統計
篩選列同一行最右側顯示即時統計數字：
- 緩存 N · 完成 N · 退款 N · 共 N 筆

---

## 3. 資料來源（Supabase）

### 核心表
- **client_services**（訂單主表）：client_id, treatment_id, total_price, total_sessions, remaining_sessions, unit_price, purchase_date, status
- **payment_transactions**（收錢記錄）：client_id, treatment_id, amount, transaction_date, settled_by
- **refunds**（退款記錄）：client_service_id, refund_amount, refund_date, reason, refunded_by

### JOIN 關係
```
client_services
  ├── clients (id → name)
  └── treatments (id → name)

payment_transactions
  ├── clients (name)
  ├── treatments (name)
  └── profiles (name via settled_by)

refunds
  ├── client_services → clients (name), treatments (name)
  └── profiles (name via refunded_by)
```

### 過濾日期範圍
- 根據 `purchase_date`（購買日期）篩選 client_services
- 退款根據 `refund_date` 篩選

### 排除 VOID
- `payment_transactions.remarks` 唔包含 `VOID` 嘅記錄先計入已收金額
- VOID 交易仍顯示喺列表中但灰色標示

---

## 4. 互動邏輯

1. 改日期範圍 → 全部數據重新 fetch + list 更新
2. Click Tab → list filter + 對應快捷 chips 出現
3. Click Chip → list 再 filter（二級篩選，喺 Tab 基礎上）
4. 改員工下拉 / 客戶搜尋 → list filter（同 Tab + Chip 條件疊加）
5. Click 匯出 Excel → 觸發 `exportSales(supabase)`

---

## 5. 技術約束

- 用原生 `<table>`，唔用 Flowbite `<Table>`
- 頁面 layout：`flex flex-col min-h-0`，內部滾動 `overflow-auto`
- Sticky `<thead>` 用 `z-0`
- Tailwind config 已有顏色變數：`primary`, `surface`, `bg`, `text`, `text-muted`, `success`, `warning`, `danger`, `info`
- 使用 `@heroicons/react/24/outline` 圖示
- Supabase client import path：`@/config/supabase`
- Excel export：`@/utils/exportExcel` 嘅 `exportSales(supabase)`

---

## 6. 不需要的東西

- ❌ 唔需要「收入」字眼 — 呢頁叫「訂單管理」
- ❌ 唔需要收款方式統計（現金/卡/轉賬分類）
- ❌ 唔需要區塊分割框架
- ❌ 唔需要獨立 summary card
- ❌ 唔需要「今日收入」「每日結算」等舊詞

**設計由你全權決定。功能以上述為準，其餘自由發揮。**
