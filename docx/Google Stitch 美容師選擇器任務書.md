# 新增預約頁面 — 美容師選擇器改造任務書

> **只描述功能與狀態邏輯，不干涉 UI 設計。設計由你全權決定。**

---

## 1. 任務範圍

改造 `NewAppointmentPage.jsx` 中「美容師選擇」區塊。
目前係原生 `<select>` dropdown，員工休假只靠 `(休假)` 兩個字，視覺極唔明顯。

**改為視覺化按鈕群組（Grid Cards），讓店長一眼睇晒今日邊個有上班、邊個放假、邊個已撞期。**

---

## 2. 員工三種狀態

根據使用者已選嘅「日期」同「開始時間」，逐一判斷每位員工狀態：

### 🟢 可預約
- **條件**：員工當日有排班 + 非休假 + 該時段無衝突
- **行為**：可點擊選取，選中後 set `form.staff_id`
- **視覺要求**：正常飽和色，顯示員工姓名 + 當日上班時間

### 🔴 今日休假
- **條件**：員工當日 `is_off = true`，或無任何排班記錄
- **行為**：不可點擊
- **視覺要求**：明顯變灰/降低透明度 + 醒目標示（如 `🏖️ 休假`）

### 🟡 時段已佔用
- **條件**：員工有上班，但該時段已被另一筆預約佔用
- **行為**：不可點擊
- **視覺要求**：警告樣式 + `⚠️ 已佔用`

---

## 3. 互動邏輯

1. 使用者改「日期」或「時間」 → 所有卡片狀態即時聯動更新
2. 點擊可預約卡片 → 選取（Active 樣式）
3. 再次點擊已選取 → 取消選取
4. 單選

---

## 4. 資料來源（現有 state）

| state 變數 | 來源資料庫表 | 結構 |
|-----------|-------------|------|
| `staff` | `profiles` | `{ id, name, role, is_active }` |
| `schedules` | `staff_schedules` | `{ id, staff_id, day_of_week, start_time, end_time, is_off }` |
| `form.appointment_date` | string | `"2026-06-12"` |
| `form.start_time` | string | `"10:00"` |
| `form.staff_id` | string｜UUID | 目前選中 |

現有 helper function：

```js
getScheduleHint(staffId)
// 返回： "（無排班）" / "（休假）" / "（10:00-19:00）"
```

現有衝突檢查：

```js
checkConflicts()
// 查 appointments WHERE appointment_date = form.date
//   AND start_time < getEndTime() AND end_time > form.start_time
//   AND status != 'cancelled'
// 偵測 staff_id / room_id / equipment_id 衝突 → set conflictMsg
```

---

## 5. 技術約束

- `profiles` 表（唔好用 `staff` — 呢個表唔存在）
- `appointments` 時間欄位係 `start_time` + `end_time`（唔係 `appointment_time`）
- `staff_schedules.day_of_week` = 0-6（0=日，1=一...）
- JavaScript `new Date("2026-06-12").getDay()` 都係 0-6
- Grid 佈局，Tailwind CSS
- 只改美容師選擇區塊，其他欄位勿動
