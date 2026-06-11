# 新增預約頁面 — 美容師選擇器改造任務書

> 只描述功能與狀態邏輯，不干涉 UI 設計。設計由你全權決定。

---

## 1. 任務範圍

改造 `NewAppointmentPage.jsx` 中「美容師選擇」區塊。
目前係原生 `<select>` dropdown，員工休假只靠 `(休假)` 兩個字示警，視覺極唔明顯。

**改為視覺化按鈕群組（Grid Cards），讓店長一眼睇晒今日邊個有上班、邊個放假、邊個已撞期。**

只改美容師選擇呢個區塊。房間選擇、時間選擇等其他欄位唔好郁。

---

## 2. 員工三種狀態

根據使用者已選嘅「日期」同「開始時間」，逐一判斷每位員工狀態：

### 🟢 可預約
- **條件**：該員工當日有排班（`staff_schedules.day_of_week` = 選定日期的星期）、非休假（`is_off = false`）、且 `appointments` 中該時段沒有與其他預約重疊
- **行為**：可點擊選取
- **視覺要求**：卡片正常飽和色，顯示員工姓名 + 當日上班時間（如 `10:00 - 19:00`）

### 🔴 今日休假
- **條件**：該員工當日 `staff_schedules.is_off = true`，或無任何排班記錄
- **行為**：不可點擊（disabled）
- **視覺要求**：卡片明顯變灰 / 降低透明度、加上醒目標示（如 `🏖️ 休假`）

### 🟡 時段已佔用
- **條件**：該員工有上班，但 `appointments` 中該時段已被另一筆預約佔用（非 `cancelled`）
- **行為**：不可點擊（disabled）
- **視覺要求**：卡片警告樣式（黃色邊框 / 斜線背景）、加上 `⚠️ 已佔用`

---

## 3. 互動邏輯

1. 使用者改「日期」或「時間」 → 所有卡片狀態即時聯動更新
2. 點擊 🟢 可預約卡片 → 選取該員工（`form.staff_id = 該員工 id`）
3. 再次點擊已選取卡片 → 取消選取（`form.staff_id = ''`）
4. 同一時間只能選一個員工
5. 選中卡片要有明顯 Active 樣式（粗邊框 / 主色背景 / 打勾圖示）

---

## 4. 資料來源

所有現有 state，無需新 query：

| 變數 | 來源表 | 說明 |
|------|--------|------|
| `staff` | `profiles` | 所有使用者（role 不限） |
| `schedules` | `staff_schedules` | staff_id, day_of_week, start_time, end_time, is_off |
| `form.appointment_date` | — | 使用者已選日期 |
| `form.start_time` | — | 使用者已選開始時間 |
| `form.staff_id` | — | 目前選中嘅員工 ID |
| `getScheduleHint(staffId)` | — | 現有 function，返回 `（無排班）` / `（休假）` / `（10:00-19:00）` |
| `getEndTime()` | — | 現有 function，返回預計結束時間 |

衝突檢查沿用現有 `checkConflicts()` function（會 set `conflictMsg`）。

---

## 5. 技術約束

- Tailwind CSS
- Grid 佈局（`grid-cols-2` 或 `grid-cols-3`）
- 唔使用 Flowbite `<Select>` 或原生 `<select>`
- 唔使用 `from('staff')` — 冇呢個表，用 `profiles`
- `appointments` 時間欄位係 `start_time` + `end_time`（TIME type），唔係 `appointment_time`
- 必須保留現有 `checkConflicts()` + `conflictMsg` 機制

---

## 6. 唔好改嘅野

- 房間選擇、儀器選擇 — 保持原生 select
- 日期、時間 input — 保持原樣
- 送出按鈕、衝突提示 — 保持原樣
- 其他頁面 — 完全唔關事
