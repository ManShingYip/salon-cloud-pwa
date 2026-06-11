# 🤖 任務委派：Google Stitch — React PWA 前端頁面生成

**委派對象**：Google Stitch（Google AI 程式碼生成工具）
**任務目的**：為美容院雲端管理系統生成 **React JSX 元件檔**，使用 Tailwind CSS + Flowbite 元件庫，產出可直接放入 Vite 專案的 `.jsx` 檔案。

---

## ⚠️ 重要：輸出格式約束

**你必須生成 React JSX 檔案（.jsx），不是純 HTML！**

你的輸出會直接放入以下 Vite + React 專案結構中：

```
salon-pwa/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── sw.js                  # PWA Service Worker
└── src/
    ├── main.jsx               # React 進入點
    ├── App.jsx                # 路由 + 佈局
    ├── index.css              # Tailwind directives + CSS 變數
    ├── config/
    │   └── supabase.js        # Supabase client 初始化
    ├── components/
    │   ├── ui/                # 基礎 UI 元件
    │   │   ├── Button.jsx
    │   │   ├── Input.jsx
    │   │   ├── Modal.jsx
    │   │   ├── Tag.jsx
    │   │   ├── Select.jsx
    │   │   └── SearchBar.jsx
    │   ├── layout/            # 佈局元件
    │   │   ├── AppLayout.jsx
    │   │   ├── Sidebar.jsx
    │   │   └── Header.jsx
    │   ├── appointments/      # 預約相關
    │   │   ├── AppointmentCard.jsx
    │   │   ├── DailyTimeline.jsx
    │   │   ├── MiniCalendar.jsx
    │   │   ├── NewAppointmentForm.jsx
    │   │   └── ConflictChecker.jsx
    │   ├── clients/           # 客戶相關
    │   │   ├── ClientCard.jsx
    │   │   ├── ClientSearch.jsx
    │   │   ├── ClientDetail.jsx
    │   │   └── ClientTag.jsx
    │   ├── treatments/        # 療程相關
    │   │   ├── TreatmentList.jsx
    │   │   ├── PaymentModal.jsx
    │   │   └── TreatmentInventory.jsx
    │   └── settlement/        # 結算相關
    │       ├── DailySettlement.jsx
    │       ├── PaymentMethodCard.jsx
    │       └── SettlementConfirm.jsx
    └── pages/                 # 頁面元件
        ├── DailyAppointmentsPage.jsx   # A. 今日預約總覽
        ├── NewAppointmentPage.jsx      # B. 預約建立表單
        ├── ClientDetailPage.jsx        # E. 客戶詳情（療程庫存 + 收錢/退款）
        ├── DailySettlementPage.jsx     # D. 收入紀錄
        ├── TreatmentManagePage.jsx     # 療程管理（店長）
        ├── ActivityLogPage.jsx         # 系統日誌（店長）
        └── DormantClientsPage.jsx      # 沉睡客列表（店長）
```

---

## 📋 專案背景

這是一間本地中小型美容院的管理系統，使用者在 iPad（橫向 1024×768）上操作。**所有操作都是觸控**，沒有滑鼠 hover。

### 技術規則

| 規則 | 說明 |
|------|------|
| **CSS** | 只用 Tailwind utility classes，不寫自訂 CSS |
| **元件庫** | 優先使用 Flowbite React 元件（Modal、Button、Table、Datepicker 等） |
| **圖標** | 使用 Heroicons（`@heroicons/react`） |
| **路由** | React Router v6 |
| **狀態** | React useState / useContext（不用 Redux） |
| **API** | 透過 `src/config/supabase.js` 的 Supabase client 呼叫 |
| **響應式** | 以 iPad 橫向 (1024×768) 為首要目標，但也需在直向 (768×1024) 正常顯示 |

### 現有套件（已在 package.json）

```json
{
  "react": "^18.3.x",
  "react-dom": "^18.3.x",
  "react-router-dom": "^6.x",
  "flowbite-react": "^0.10.x",
  "@heroicons/react": "^2.x",
  "@supabase/supabase-js": "^2.x",
  "xlsx": "^0.18.x"
}
```

### Supabase Client（已存在，直接 import）

```js
// src/config/supabase.js — 你不需要生成此檔，只需 import
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## 🎨 設計系統（必須遵守）

### 主題 A：溫柔專業（玫瑰金 + 米色）— 預設使用此主題

```css
:root {
  /* 主色 */
  --color-primary: #C88EA7;       /* 玫瑰金 */
  --color-primary-light: #E8D5DA; /* 淺玫瑰 */
  --color-primary-dark: #9B6B82;  /* 深玫瑰 */
  /* 輔色 */
  --color-bg: #FEFAF6;            /* 米白背景 */
  --color-surface: #FFFFFF;       /* 卡片白 */
  --color-text: #3D2C33;          /* 深棕文字 */
  --color-text-muted: #8B7E82;    /* 灰褐次要文字 */
  /* 功能色 */
  --color-success: #6B9B7D;       /* 鼠尾草綠 */
  --color-warning: #D4A574;       /* 暖琥珀 */
  --color-danger: #D4736A;        /* 暖紅 */
  --color-info: #7B9CB5;          /* 灰藍 */
  /* 尺寸 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-card: 0 2px 12px rgba(61,44,51,0.06);
  --shadow-modal: 0 8px 32px rgba(61,44,51,0.12);
}
```

### Tailwind Config 擴展（供參考，你不需要產生 tailwind.config.js）

```js
// 這些顏色已在 tailwind.config.js 中定義為自訂色板
colors: {
  primary: { DEFAULT: '#C88EA7', light: '#E8D5DA', dark: '#9B6B82' },
  surface: '#FFFFFF',
  bg: '#FEFAF6',
  danger: '#D4736A',
  success: '#6B9B7D',
  warning: '#D4A574',
}
```

### 元件樣式規則

| 元件 | Tailwind 寫法 |
|------|--------------|
| **Primary Button** | `bg-primary text-white rounded-xl px-6 py-3 text-base font-medium min-h-[48px] min-w-[44px] shadow-sm active:scale-95 transition-transform` |
| **Secondary Button** | `border-2 border-primary text-primary rounded-xl px-6 py-3 text-base font-medium min-h-[48px] bg-transparent` |
| **Danger Button** | `bg-danger text-white rounded-xl px-6 py-3 text-base font-medium min-h-[48px]` |
| **Input** | `bg-surface border border-gray-200 rounded-xl px-4 py-3 text-base min-h-[48px] focus:border-primary focus:ring-2 focus:ring-primary-light outline-none` |
| **Card** | `bg-surface rounded-2xl p-5 shadow-[0_2px_12px_rgba(61,44,51,0.06)]` |
| **Tag** | `inline-flex rounded-lg px-3 py-1 text-xs font-medium` |
| **Modal** | 使用 Flowbite `<Modal>`，半透明遮罩 + 內容置中 + 按鈕固定在底部 |
| **表格** | 使用 Flowbite `<Table>`，行高至少 48px（方便點擊） |

---

## 📄 你需要生成的檔案清單與要求

### 檔案 1：`src/index.css`

Tailwind 基礎 + CSS 變數：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #C88EA7;
  --color-primary-light: #E8D5DA;
  --color-primary-dark: #9B6B82;
  --color-bg: #FEFAF6;
  --color-surface: #FFFFFF;
  --color-text: #3D2C33;
  --color-text-muted: #8B7E82;
  --color-success: #6B9B7D;
  --color-warning: #D4A574;
  --color-danger: #D4736A;
  --color-info: #7B9CB5;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang TC', 'SF Pro Text', sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-tap-highlight-color: transparent;
}
```

---

### 檔案 2：`src/App.jsx`

- 使用 React Router v6
- 預設 Layout 為 `AppLayout`（Sidebar + 內容區）
- 路由表：

| 路徑 | 頁面元件 | 誰可見 |
|------|---------|--------|
| `/` | `DailyAppointmentsPage` | 所有人 |
| `/appointments/new` | `NewAppointmentPage` | 所有人 |
| `/appointments/:id` | 預約詳情（可先導向 modal） | 所有人 |
| `/clients` | 客戶搜尋列表 | 所有人 |
| `/clients/:id` | `ClientDetailPage` | 所有人 |
| `/settlement` | `DailySettlementPage` | 所有人 |
| `/treatments` | `TreatmentManagePage` | 店長 |
| `/logs` | `ActivityLogPage` | 店長 |
| `/dormant` | `DormantClientsPage` | 店長 |

- 用一個簡單的 `AuthContext` 提供 `user` 物件（含 `role`），目前先用 mock：
  ```js
  const [user] = useState({ id: '1', name: '店長', role: 'shop_owner' })
  ```

---

### 檔案 3：`src/components/layout/AppLayout.jsx`

- iPad 橫向 (1024×768) 為預設
- **左側 Sidebar**（寬 220px）：Logo + 導航連結 + 使用者資訊
- **右側內容區**（剩餘寬度）：`<Outlet />` 渲染子路由
- Sidebar 導航項目（使用 Heroicons）：
  - 📅 今日預約 (`CalendarDaysIcon`)
  - 👥 客戶管理 (`UsersIcon`)
  - 💆 療程管理 (`SparklesIcon` — 僅店長)
  - 💰 收入紀錄 (`BanknotesIcon`)
  - 📋 活動日誌 (`ClipboardDocumentListIcon` — 僅店長)
  - 😴 沉睡客戶 (`MoonIcon` — 僅店長)
- **不要 Top Nav**（iPad 用 Sidebar 最合理，因為雙手握持時拇指在兩側，不需伸手去頂部）

---

### 檔案 4：`src/components/ui/Button.jsx`

- props: `variant` (`primary` | `secondary` | `danger`), `size` (`md` | `lg`), `disabled`, `loading`, `onClick`, `children`, `icon` (Heroicon component)
- loading 時顯示 spinner + 禁用點擊
- 所有按鈕最小高度 48px（觸控友善）

---

### 檔案 5：`src/components/ui/Modal.jsx`

包裝 Flowbite `<Modal>`，統一風格：
- `show` / `onClose` / `title` / `children` / `footer` props
- 背景半透明遮罩
- 內容區可滾動
- footer 固定底部（按鈕區）

---

### 檔案 6：`src/components/ui/Tag.jsx`

- props: `color` (`rose` | `green` | `amber` | `blue` | `gray`), `children`
- 對應到 Tailwind 顏色（用 primary / success / warning / info / gray-400）
- 小圓角標籤

---

### 檔案 7：`src/pages/DailyAppointmentsPage.jsx`（最重要！）

**A. 今日預約總覽**

佈局（iPad 橫向 1024×768）：
```
┌──────────────┬──────────────────────────────────────┐
│  頂部搜尋欄  │  🔍 搜尋客戶（電話/姓名）...         │
├──────────────┼──────────────────────────────────────┤
│  左 280px    │  右側：當日預約列表                   │
│              │                                      │
│  迷你日曆    │  ┌──────────────────────────────┐    │
│  (可切換     │  │ 10:00 陳小明 · 激光脫毛     │    │
│   日期)     │  │ 美容師: Amy · 房間A · 儀器3  │    │
│              │  │ [已確認] [標籤]              │    │
│  ┌──┬──┬──┐ │  ├──────────────────────────────┤    │
│  │日│一│二│ │  │ 11:30 李美美 · 膠原蛋白療程  │    │
│  │..│..│..│ │  │ 美容師: Betty · 房間B       │    │
│  └──┴──┴──┘ │  │ [已出席] [標籤]              │    │
│              │  ├──────────────────────────────┤    │
│  今日統計    │  │ 14:00 王小明 · 深層清潔     │    │
│  共 8 個預約 │  │ ...                          │    │
│  已出席: 3   │  └──────────────────────────────┘    │
│  待出席: 5   │                                      │
├──────────────┼──────────────────────────────────────┤
│  底部浮動欄  │  [+ 新增預約]  [💰 快速結算]        │
└──────────────┴──────────────────────────────────────┘
```

功能：
- 載入當日預約（從 Supabase `appointments` 表）
- 點擊日曆切換日期
- 點擊預約卡片可查看詳情
- 預約卡片顯示：時間、客戶名、療程、美容師、房間、狀態標籤
- 將預約改為「已出席」時 → **彈出 PaymentModal**（收錢確認）
- 底部浮動按鈕：新增預約、快速結算
- 特殊敏感客戶有 ⚠️ 圖示

---

### 檔案 8：`src/pages/NewAppointmentPage.jsx`

**B. 預約建立表單**

- 步驟式或單頁式表單（≤3 步）
- 選擇：客戶（搜尋+選擇）→ 療程 → 美容師 → 日期時間 → 房間 → 儀器
- **三維防撞檢查**：選擇時間後，自動查詢該時段內：
  - 該美容師是否有其他預約？
  - 該房間是否被佔用？
  - 該儀器是否被佔用？
  - 有衝突時，該時段顯示紅色/灰色不可選
- 時間選擇器可用簡單的時間區塊網格（營業時間 10:00-21:00，每30分鐘一格）
  ```
  時間    │ 美容師Amy    │ 美容師Betty  │
  ────────┼─────────────┼─────────────┤
  10:00   │ 可用        │ 已預約       │
  10:30   │ 可用        │ 已預約       │
  11:00   │ 可用        │ 可用         │
  ```
- 儲存後跳轉回首頁

---

### 檔案 9：`src/components/treatments/PaymentModal.jsx`（收錢確認彈窗）

**C. 收錢確認彈窗**

- 當預約狀態改為「已出席」時觸發彈出（Appointment 模式）
- 或者店長手動對某療程按「收錢」時觸發（Manual 模式）
- Modal 結構：
  ```
  ┌─────────────────────────────────────┐
  │  💳 收錢確認                         │
  │                                      │
  │  客戶：陳小明 (會員編號: M001)       │
  │  療程：激光脫毛 @ 10:00             │
  │                                      │
  │  收款金額：[$____] 自由輸入          │
  │  付款方式：[💵 現金 ▾]              │
  │  實收金額：[$____]（現金可計找續）  │
  │  消耗次數：[1]（做完服務先扣）      │
  │                                      │
  │  備註：[_______________]             │
  │                                      │
  │      [取消]     [✅ 確認收錢]        │
  └─────────────────────────────────────┘
  ```

功能：
- 收款金額**自由輸入**，唔跟單價 auto-calc
- 付款方式下拉（現金/信用卡/轉賬/其他）
- 可選消耗療程次數（預設 1）
- Appointment 模式：列出該客戶所有可用療程，可多選
- Manual 模式：單一療程 + 自由輸入金額 + 次數
- 確認後：扣減 client_services 次數 + 寫入 payment_transactions 記錄

---

### 檔案 10：`src/pages/DailySettlementPage.jsx`

**D. 收入紀錄（訂單記錄模式 — v2 雙框架）**

佈局：
```
💰 收入紀錄
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[篩選列] 日期範圍: [____] ~ [____]  狀態: [全部 ▾]  客戶搜尋: [________]  收款方式: [全部 ▾]

┌── 🟡 緩存中 ──────────┐  ┌── 🟢 確定收入 ──────────┐
│  3 筆 · HK$8,500 待收  │  │  12 筆 · HK$38,500 已收   │
│  未收足 / 未做完服務    │  │  已收足 + 已做完服務      │
└────────────────────────┘  └──────────────────────────┘

📋 訂單記錄 (一單一記錄)
客戶    │ 療程     │ 已收/總額       │ 進度     │ 收款方式 │ 日期   │ 狀態
────────┼──────────┼────────────────┼─────────┼─────────┼───────┼──────
陳小明  │ 激光脫毛 │ $1,500/$5,000  │ ███░░ 30%│ 💵 現金 │ 6/10  │ 🟡 緩存
李美美  │ 膠原蛋白 │ $2,280/$2,280  │ ██████100%│ 💳 信用卡│ 6/09  │ 🟢 完成
張小麗  │ 深層清潔 │ $380/$380      │ ██████100%│ 📱 轉賬 │ 6/08  │ 🟢 完成
陳小明  │ 激光脫毛 │ $2,500/$5,000  │ █████ 50%│ 💵 現金 │ 6/03  │ 🟡 緩存
ghgfg   │ 背部按摩 │ $0/$1,200      │ ░░░░   0%│ -       │ 5/28  │ 🟡 緩存

📊 收款方式統計 (本月)
💵 現金 $14,200 │ 💳 信用卡 $8,600 │ 📱 轉賬 $5,300 │ 📋 其他 $2,100
```

功能（v2）：
- **篩選列**：日期範圍 + 狀態下拉（全部/緩存中/確定收入/已退款）+ 客戶搜尋 + 收款方式
- **🟡 緩存框架**：任何 remaining > 0 OR SUM(已收) < total_price 嘅訂單，顯示筆數+待收金額
- **🟢 確定收入框架**：已完成 + 已收足嘅交易，顯示筆數+已收金額
- **點擊框架卡** → 自動 filter 下方 list
- **下方 List（一單一記錄）**：每行 = 一筆 payment_transactions
  - 分期顯示進度 bar + 百分比
  - 已完成顯示綠色標記
  - 服務日期跟 transaction_date
- **底部收款方式統計**：四種方式金額彙總
- **不需要**鎖定/結算功能 — 純展示

---

### 檔案 11：`src/pages/ClientDetailPage.jsx`

**E. 客戶詳情與療程庫存**

佈局（v2 — 收錢模式）：
```
┌──────────────────────────────────────────────┐
│  ← 返回客戶列表          [編輯客戶資料]      │
├──────────────────┬───────────────────────────┤
│  左 320px        │  右側：已購療程庫存       │
│                  │                           │
│  客戶資訊        │  ┌───────────────────┐    │
│  姓名：陳小明    │  │ 激光脫毛 (全臉)   │    │
│  電話：9123**** │  │ 總額 HK$5,000     │    │
│  會員編號：M001  │  │ 已收 HK$1,500     │    │
│                  │  │ 剩餘 5/10 次      │    │
│  來源：[IG廣告] │  │ 到期日：2026-12-31 │    │
│  標籤：[特殊敏感]│  │ 🟡 緩存中（分期） │    │
│                  │  │ [收錢] [退款]     │    │
│  備註：          │  ├───────────────────┤    │
│  客人怕痛，需用  │  │ 膠原蛋白導入      │    │
│  低能量          │  │ 總額 HK$2,280     │    │
│                  │  │ 已收 HK$2,280     │    │
│                  │  │ 剩餘 0/6 次       │    │
│                  │  │ 🟢 已完成         │    │
│                  │  └───────────────────┘    │
├──────────────────┴───────────────────────────┤
│  下方：預約歷史                               │
│  日期 │ 療程 │ 美容師 │ 狀態 │ 備註          │
│  6/10 │ 激光 │ Amy   │ 已出席 │             │
└──────────────────────────────────────────────┘
```

功能（v2）：
- 左側：客戶資訊（含特殊敏感 ⚠️ 提示）
- 右側：已購療程訂單列表，每項顯示總額/已收/剩餘次數/到期日
- 🟡 緩存中（未收足錢 OR 未做完服務）vs 🟢 已完成
- [收錢] 按鈕：彈出 PaymentModal，自由輸入收款金額 + 消耗次數
- [退款] 按鈕：自由輸入退款金額 + 退款方式
- 下方：預約歷史表格

---

### 檔案 12-16：輔助頁面

| 檔案 | 說明 |
|------|------|
| `src/pages/TreatmentManagePage.jsx` | 療程庫管理（店長）：列表 + 新增/編輯療程 |
| `src/pages/ActivityLogPage.jsx` | 活動日誌（店長）：只讀表格，可按日期/類型篩選 |
| `src/pages/DormantClientsPage.jsx` | 沉睡客列表（店長）：90 天無預約的客戶，可一鍵發送提醒 |
| `src/components/clients/ClientSearch.jsx` | 客戶搜尋元件：搜尋欄 + 結果列表（顯示電話後四碼 + 會員編號） |
| `src/components/appointments/ConflictChecker.jsx` | 三維防撞檢查元件：顯示所選時段的美容師/房間/儀器可用狀態 |

---

## 🔧 通用規則（所有檔案必須遵守）

1. **import 路徑**：統一使用 `@/` 別名指向 `src/`（Vite alias 已設好）
   ```js
   import Button from '@/components/ui/Button'
   import { supabase } from '@/config/supabase'
   ```

2. **所有文字必須是繁體中文**（介面文字、placeholder、錯誤訊息等）

3. **資料取得模式**：
   ```js
   // 用 useEffect + useState 載入資料
   const [data, setData] = useState([])
   const [loading, setLoading] = useState(true)
   useEffect(() => {
     supabase.from('table').select('*').then(({ data, error }) => {
       setData(data); setLoading(false)
     })
   }, [])
   ```

4. **觸控優化**：
   - 所有可點擊元素 `min-h-[48px] min-w-[44px]`
   - 列表項目之間有足夠間距（`gap-3` 以上）
   - 不使用 `hover:` 改用 `active:`

5. **Flowbite 使用**：優先使用 Flowbite React 元件而非自造輪子
   ```js
   import { Table, Badge, Spinner, Datepicker, TextInput, Textarea, Select } from 'flowbite-react'
   ```

6. **PWA 離線**：不需處理（Service Worker 已另外設定）

7. **貨幣格式**：使用港幣 `HK$` 前綴，`HK$12,800`

8. **日期格式**：使用 `yyyy-MM-dd` 或 `MM月dd日 (週X)`

---

## 📦 交付方式

請為每個檔案單獨輸出，標示清楚檔案路徑（例如 `// File: src/pages/DailyAppointmentsPage.jsx`），讓我能直接複製貼上到對應路徑。

每個檔案開頭請加一行註解說明用途，例如：
```jsx
/**
 * 今日預約總覽頁面 - iPad 橫向為主
 * 左側迷你日曆 + 右側預約時間線 + 底部操作按鈕
 */
```

---

## 🧪 驗證情境

生成完成後，以下流程必須能正常運作：

1. 員工打開 App → 看到今日預約列表 → 點擊某預約改為「已出席」→ 收錢彈窗出現 → 輸入金額 + 勾選療程 → 確認 → 次數消耗 + 收款記錄寫入
2. 店長打開收入紀錄 → 看到緩存框架（未完成）+ 確定收入框架（已完成）→ 純展示，不鎖定
3. 店長查看某客戶詳情 → 看到療程訂單（總額/已收/剩餘）→ 按「收錢」自由輸入金額 → Log 寫入

---

請開始生成所有檔案！
