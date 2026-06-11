# 建立新預約 — 美容師選擇器 UI 改造

> **只描述功能與狀態邏輯，不干涉 UI 設計。**
> 設計由你全權決定。

---

## 任務目標

改造 `NewAppointmentPage.jsx` 中「資源安排 — 美容師選擇」區塊。
目前用原生 `<select>` 下拉 + `(休假)` 文字標示，視覺極唔明顯。

**改為視覺化按鈕群組（Grid Cards），讓店長一眼睇晒邊個有返工、邊個放假、邊個撞期。**

---

## 三種員工狀態

根據使用者已選擇嘅「日期」+「開始時間」，即時判斷每位員工狀態：

### 🟢 可預約 (Available)
| 項目 | 說明 |
|------|------|
| 判斷 | `staff_schedules` 當日非休假 + `appointments` 該時段無衝突 |
| 視覺要求 | 正常顏色，顯示員工名 + 上班時間（如 `10:00-19:00`） |
| 互動 | 可點擊選取 |

### 🔴 今日休假 (Off-Duty)
| 項目 | 說明 |
|------|------|
| 判斷 | `staff_schedules` 該員工當日 `is_off = true` |
| 視覺要求 | 明顯反灰/降低透明度 + 醒目標示（如 `🏖️ 休假`） |
| 互動 | 不可點擊 (disabled) |
| 排序 | 自動排到最下方 |

### 🟡 時段已佔用 (Conflict)
| 項目 | 說明 |
|------|------|
| 判斷 | 員工有上班，但 `appointments` 該時段已被佔用 |
| 視覺要求 | 警告樣式（如黃色邊框）+ 標示 `⚠️ 時段已佔用` |
| 互動 | 不可點擊 (disabled) |

---

## 互動邏輯

1. 使用者改「日期」或「時間」→ 所有卡片狀態即時重新判斷
2. 點擊可預約卡片 → 選取該員工（Active 狀態：粗邊框 / 主色背景 / 打勾）
3. 已選取嘅卡片 → 再 click 一下取消選取
4. 只能選一個員工（single select）

---

## 資料來源

所有數據喺 `NewAppointmentPage` 已有 state：

```
staff          — profiles 表 (id, name)
schedules      — staff_schedules 表 (staff_id, day_of_week, start_time, end_time, is_off)
form.appointment_date — 選定日期
form.start_time       — 選定開始時間
form.staff_id         — 目前選中嘅員工 ID
```

衝突檢查已有 function `checkConflicts()` 可用。

排班提示 function `getScheduleHint(staffId)` 已存在，返回：
- `（無排班）`
- `（休假）`
- `（10:00-19:00）`

---

## 技術約束

- Tailwind CSS
- Grid 佈局（`grid-cols-2` / `grid-cols-3`）
- 唔使用 Flowbite `<Select>`
- 現有 `conflictMsg` state + `checkConflicts()` 保留

---

## 唔需要改嘅嘢

- 房間選擇、儀器選擇 — 保持原樣
- 其他頁面 — 唔關事
