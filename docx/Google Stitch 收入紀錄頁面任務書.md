# 收入紀錄頁面 — Google Stitch 任務書

> **只描述功能與數據，不干涉 UI 設計。**
> 設計由你全權決定 — 顏色、間距、排版、元件選擇。

---

## 1. 頁面目的

美容院店長每日打開呢頁，管理所有訂單收入狀況。核心動作：
- 快速睇到邊個客爭錢（欠款未找數）
- 快速睇到邊個客做完未俾錢
- 快速睇到邊個客退咗款
- Click 任何分類 → 下面列表即時 filter

---

## 2. 元件需求

### 2.1 頁面標題區
- 標題文字：`💰 收入紀錄`
- 副標題：`全部訂單交易列表`
- 右上角按鈕：`匯出 Excel`

### 2.2 篩選區
全部篩選放喺同一行/區：
| 篩選項 | 類型 | 說明 |
|--------|------|------|
| 日期範圍 | 兩個 date input | 開始日期 ～ 結束日期，預設本月 |
| 經手人 | 下拉選單 | `全部` + 所有活躍 profile |
| 客戶搜尋 | 文字輸入框 | 搜尋客戶姓名 |

### 2.3 狀態切換 Tabs
四個切換狀態，click 即 filter 下面 list：

| Tab | 過濾邏輯 | 顯示數字 |
|-----|----------|----------|
| **全部** | 顯示所有訂單（含退款） | 總筆數 |
| **緩存中** (🟡) | remaining > 0 OR paid < total | 緩存筆數 |
| **確定收入** (🟢) | remaining = 0 AND paid >= total | 完成筆數 |
| **退款紀錄** (🔴) | 退款記錄 | 退款筆數 |

每個 Tab 上顯示對應筆數。

### 2.4 快捷分類 Chips（只喺選中 Tab 後出現）

| Tab | Chips |
|-----|-------|
| 緩存中 | 「欠款未找」n 筆 HK$X · 「未做套票」n 筆 HK$X · 「高風險 >60日」n 筆 HK$X |
| 確定收入 | 「本月完成」n 筆 HK$X · 「過往累積」n 筆 HK$X |
| 退款紀錄 | 「本月退款」n 筆 HK$X · 「過往退款」n 筆 HK$X |

Click chip → 再 filter list（幫店長快速 drill down）。

快捷分類定義：
- 欠款未找：remaining = 0 AND paid < total（做完未俾錢）
- 未做套票：remaining > 0（未做完）
- 高風險：欠款天數 > 60 日
- 本月完成/退款：transaction_date / refund_date >= 今個月 1 號
- 過往完成/退款：transaction_date / refund_date < 今個月 1 號

### 2.5 訂單列表（表格）
一個大表格顯示所有記錄，**一行 = 一筆 payment_transactions（收錢動作）或一筆退款**。

Columns：

| Column | 資料來源 | 格式 |
|--------|----------|------|
| 客戶 | `clients.name` | 粗體 |
| 療程 | `treatments.name` | 普通文字 |
| 已收 / 總額 | paid / total_price | `$1,500 / $5,000`（退款行只顯示金額） |
| 進度 | paid ÷ total_price | 百分比條 + 數字%（退款行顯示退款原因前 20 字） |
| 最後異動日 | transaction_date 或 refund_date | `06-10 (收錢)` / `05-28 (退款)` / `06-01 (已退回)` |
| 經手人 | profiles.name | 員工名 |
| 狀態 | buffer / confirmed / refund / void | 標籤 |

### 2.6 篩選列右上角 Inline 統計
篩選列同一行最右側顯示即時統計數字：
- 🟡 緩存 N
- 🟢 完成 N
- 🔴 退款 N
- 共 N 筆

---

## 3. 資料來源（Supabase）

### 三表 JOIN

```
client_services
  ├── clients (name)
  └── treatments (name)

payment_transactions
  ├── clients (name)
  ├── treatments (name)
  └── profiles (name via settled_by)

refunds
  ├── client_services → clients (name), treatments (name)
  └── profiles (name via refunded_by)
```

### 過濾日期範圍
- `payment_transactions.transaction_date` BETWEEN from AND to
- `refunds.refund_date` BETWEEN from AND to

### 排除 VOID
- `payment_transactions.remarks` 唔包含 `VOID`
- VOID 行顯示灰色 + 劃線，仍顯示喺列表中

---

## 4. 互動邏輯

1. 改日期範圍 → 全部數據重新 fetch + list 更新
2. Click Tab → list filter + 對應快捷 chips 出現
3. Click Chip → list 再 filter（二級篩選）
4. 改員工下拉 / 客戶搜尋 → list filter（同 Tab/Chip 疊加）
5. Click 匯出 Excel → 觸發 `exportSales(supabase)`

---

## 5. 技術約束

- 用原生 `<table>`，唔用 Flowbite `<Table>`
- 頁面 layout：`flex flex-col min-h-0`，內部滾動 `overflow-auto`
- Sticky `<thead>` 用 `z-0`
- Tailwind config 已有顏色變數：primary, surface, bg, text, text-muted, success, warning, danger, info
- 使用 `@heroicons/react/24/outline` 圖示

---

## 6. 不需要的東西

- ❌ 唔需要收款方式統計（現金/卡/轉賬分類）
- ❌ 唔需要區塊分割（唔好分上下框架區）
- ❌ 唔需要獨立 summary card

**設計由你全權決定。功能以上述為準，其餘自由發揮。**
