# 新增預約頁面 — 完整功能任務書

> **你冇任何 project context。以下係你需要知嘅全部。唔好假設任何嘢。**

---

## 頁面目的

店長/員工喺 iPad 上建立新預約。一頁過，左右兩欄。

---

## 完整頁面結構

```
┌─ Header ──────────────────────────────────────────┐
│  ← 返回按鈕  │  建立新預約                         │
├──────────────┬──────────────────────────────────────┤
│ 左欄         │ 右欄                                │
│              │                                    │
│ ①客戶與療程  │ ③資源安排                          │
│  - 搜尋客戶  │  - 美容師選擇 ← 【呢區要改造】       │
│  - 已選客戶  │  - 房間選擇                        │
│  - 療程下拉  │  - 儀器選擇                        │
│              │                                    │
│ ②時間       │ ⚠️ 衝突提示                        │
│  - 日期      │                                    │
│  - 開始時間  │ 📋 預約摘要                        │
│  - 結束時間  │                                    │
│              │ [建立預約] 按鈕                     │
└──────────────┴──────────────────────────────────────┘
```

---

## ① 客戶與療程區塊（左欄上）

### 客戶搜尋
- 一個文字輸入框，placeholder `輸入姓名或電話搜尋...`
- 使用者打夠 2 個字 → call Supabase `clients` 表做 fuzzy search：
  ```js
  supabase.from('clients').select('*')
    .or(`name.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
  ```
- 結果顯示為 clickable list，每行顯示 `{name} · {phone尾4碼} {member_id}`
- Click 某一項 → set `form.client_id`，清空搜尋結果 list
- 已選客戶顯示為綠色確認行：`✅ {客戶名}`

### clients 表結構
```
id, name, phone, member_id, source, remarks, is_sensitive, sensitive_note, last_visit_date, created_at
```

### 療程選擇
- 原生 `<select>` dropdown（呢個保留，唔使改）
- 資料來源：`treatments` 表，只顯示 `is_active = true` 嘅
- 每個 option 顯示：`{name} ({duration_minutes}分 · HK${single_price})`
- treatments 表結構：`id, name, category, single_price, duration_minutes, package_sessions, is_active`
- 選擇後 → set `form.treatment_id`

---

## ② 時間區塊（左欄下）

- **日期 input**：`type="date"`，default 今日
- **開始時間 input**：`type="time"`，default `10:00`
- **結束時間**：自動計算。根據已選療程嘅 `duration_minutes` 加落 start_time
  ```js
  getEndTime() → "11:30" // 例
  ```
- 顯示文字：`預計結束時間：11:30（療程時長 90 分鐘）`
- 改日期或時間 → **觸發美容師卡片狀態重新計算**（重要！）

---

## ③ 資源安排區塊（右欄上）

### 美容師選擇 ← 🔴 要改造呢個
**目前係 `<select>` dropdown，要改做 Grid Cards。**

#### 資料來源
- `profiles` 表：所有使用者。結構：`{ id, name, role, is_active }`
- `staff_schedules` 表：排班記錄。結構：`{ id, staff_id, day_of_week, start_time, end_time, is_off }`
  - `day_of_week` = 0(日) ~ 6(六)
  - JavaScript `new Date("2026-06-12").getDay()` 都係 0-6，直接對應
- `appointments` 表：現有預約。結構：`{ id, staff_id, start_time, end_time, appointment_date, status }`
  - `start_time` / `end_time` 格式 = `"HH:MM"`（字串，唔係 timestamp）

#### 三種員工狀態（根據已選日期+時間即時判斷）

##### 🟢 可預約
- 條件：`staff_schedules` 當日 `is_off = false` + `appointments` 冇時間重疊
- 可點擊 → set `form.staff_id`
- 視覺：顯示員工名 + 上班時間（如 `10:00 - 19:00`）

##### 🔴 休假
- 條件：`staff_schedules` 當日 `is_off = true`，或完全冇該日排班
- 不可點擊
- 視覺：變灰/低透明度 + `🏖️ 休假` 標示
- 自動排到最下方

##### 🟡 已佔用
- 條件：有上班，但 `appointments` 有時間重疊（非 cancelled）
- 時間重疊判斷：`other.start_time < 呢個預約嘅end_time AND other.end_time > 呢個預約嘅start_time`
- 不可點擊
- 視覺：黃色邊框 + `⚠️ 已佔用`

#### 互動
- 改日期/時間 → 全部卡片狀態即時更新
- Click 可預約卡片 → 選取（粗邊框 / 主色背景 / 打勾）
- 再 click 已選 → 取消選取
- 單選

### 房間選擇（保留原生 select）
- `rooms` 表：`{ id, name, is_active }`
- 只顯示 `is_active = true`

### 儀器選擇（保留原生 select）
- `equipment` 表：`{ id, name, is_active }`
- 可留空（`不選儀器` option）
- 只顯示 `is_active = true`

---

## 衝突檢查邏輯

當使用者改美容師/房間/儀器 → 自動檢查：

```js
// Query appointments
supabase.from('appointments').select('staff_id, room_id, equipment_id')
  .eq('appointment_date', form.appointment_date)
  .neq('status', 'cancelled')
  .lt('start_time', endTime)    // 其他預約 start < 呢個 end
  .gt('end_time', form.start_time)  // 其他預約 end > 呢個 start
```

如果有重疊 → 顯示 `⚠️ 美容師/房間/儀器 此時段已有預約`

---

## 預約摘要（右欄中）

當已選客戶或療程 → 顯示預覽：
```
👤 陳小明 · 98765432
💆 激光脫毛 (HK$500 · 90分)
👩 Amy
🚪 Room A
📅 2026-06-12 10:00 - 11:30
```

---

## 建立預約按鈕

- 四個必填（client, treatment, staff, room）未齊 → disabled
- Click → insert `appointments`：
  ```js
  supabase.from('appointments').insert({
    client_id, staff_id, treatment_id, room_id,
    equipment_id: equipment_id || null,
    appointment_date, start_time, end_time,
    status: 'confirmed',
    created_by: current_user.id
  })
  ```
- 成功 → 顯示綠色成功畫面 `✅ 預約已建立` → 1 秒後 redirect 去 `/`

---

## 現有 state 一覽（你唔使重新設計 data flow）

```js
form = {
  client_id: '',       // UUID | ''
  treatment_id: '',    // UUID | ''
  staff_id: '',        // UUID | ''
  room_id: '',         // UUID | ''
  equipment_id: '',    // UUID | '' (optional)
  appointment_date: '2026-06-12',
  start_time: '10:00',
}

// Option lists (already fetched in useEffect)
staff       // profiles[]
treatments  // treatments[] where is_active=true
rooms       // rooms[] where is_active=true
equipment   // equipment[] where is_active=true
schedules   // staff_schedules[]
clients     // search results

// Helper functions (already exist)
getEndTime()          // returns "HH:MM"
getScheduleHint(id)   // returns "（無排班）" / "（休假）" / "（10:00-19:00）"
checkConflicts()      // queries appointments, sets conflictMsg

// UI state
conflictMsg   // string | null → if set, show <Alert color="warning">
success       // boolean → if true, show success screen
loading       // boolean → button spinner
```

---

## 技術約束

- Tailwind CSS，唔使用任何第三方 CSS library
- 可用 Flowbite React：`TextInput, Label, Card, Spinner, Alert, Badge`
- Grid 佈局（`grid-cols-2` / `grid-cols-3`）
- 原生 `<select>` 保留用於療程/房間/儀器，**只改美容師選擇器**
- 圖示用 `@heroicons/react/24/outline`
- Supabase client import from `@/config/supabase`
- Button component from `@/components/ui/Button`

---

## 唔好郁嘅嘢

- 客戶搜尋邏輯
- 療程下拉
- 日期/時間 input
- 房間/儀器下拉
- 衝突提示機制
- 預約摘要
- 建立按鈕送出邏輯
- 成功畫面
- Header 返回按鈕
