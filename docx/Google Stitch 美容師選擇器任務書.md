# 新增預約頁面 — 功能規格

## 頁面用途
店長/員工喺 iPad 上建立一個新預約。

---

## 功能清單

### 1. 返回上一頁
- 有返回按鈕，click 返去上一頁

### 2. 客戶搜尋
- 文字輸入框，打夠 2 個字觸發搜尋
- 搜尋 `clients` 表，name 或 phone 包含關鍵字就出結果
- 結果 list 每項顯示：客戶名、電話尾 4 碼、會員編號
- Click 某一項 = 選取該客戶
- 已選客戶顯示確認提示（客戶名），如有 `is_sensitive` 標記要顯示警告

`clients` 表欄位：`id, name, phone, member_id, is_sensitive, sensitive_note`

### 3. 療程選擇
- 列出所有 `is_active = true` 嘅療程
- 每項顯示療程名、時長（分鐘）、單價
- `treatments` 表欄位：`id, name, duration_minutes, single_price, is_active`

### 4. 日期選擇
- 預設今日
- 改日期 → 美容師狀態重新判斷

### 5. 開始時間選擇
- 預設 10:00
- 改時間 → 美容師狀態重新判斷

### 6. 結束時間自動計算
- 根據已選療程嘅 `duration_minutes` + 開始時間，自動計出結束時間
- 顯示預計結束時間俾使用者確認

### 7. 美容師選擇 ← 要改造
現有係 dropdown。要改成視覺化選擇器，令店長一眼睇晒每位員工今日狀態。

#### 三種員工狀態（根據已選日期+時間決定）

**狀態 A：今日休假**
- 條件：`staff_schedules` 該日 `is_off = true`，或完全冇該日排班
- 不可選取
- 需有明確標示令店長知道呢位同事今日唔返

**狀態 B：時段已佔用**
- 條件：有上班，但該時段已有其他預約（非 cancelled）
- 時間重疊判定：已有預約嘅 start_time < 新預約嘅 end_time AND 已有預約嘅 end_time > 新預約嘅 start_time
- 不可選取
- 需標示該員工已被佔用

**狀態 C：可預約**
- 條件：有上班 + 冇被佔用
- 可點擊選取
- 顯示當日上班時間段

#### 互動規則
- 改日期或時間 → 全部員工狀態即時重新判斷
- Click 可預約嘅員工 → 選取
- Click 已選取嘅員工 → 取消選取
- 只可選一個
- 選中要有明確標示

#### 涉及資料表
- `profiles`：`id, name` — 所有使用者
- `staff_schedules`：`staff_id, day_of_week(0日-6六), start_time, end_time, is_off` — 排班
- `appointments`：`staff_id, appointment_date, start_time, end_time, status` — 現有預約

### 8. 房間選擇
- 列出所有 `is_active = true` 嘅房間
- `rooms` 表欄位：`id, name, is_active`

### 9. 儀器選擇（非必填）
- 列出所有 `is_active = true` 嘅儀器
- 可選擇唔填（留空）
- `equipment` 表欄位：`id, name, is_active`

### 10. 三維衝突檢查
- 選完美容師/房間/儀器後自動檢查
- 如有時間重疊 → 顯示衝突警告，講明邊個維度撞咗（美容師/房間/儀器）
- 檢查方式：同一日期、非 cancelled、時間段重疊

### 11. 預約摘要
- 已選嘅客戶/療程/美容師/房間/日期時間，整合顯示俾使用者最後確認

### 12. 建立預約
- 四個必填未齊（客戶、療程、美容師、房間）→ 按鈕禁用
- Click → insert `appointments` 表一筆新 record
- status 預設 `confirmed`
- 成功 → 顯示成功提示 → 自動跳回首頁
- `appointments` 表必填欄位：`client_id, staff_id, treatment_id, room_id, appointment_date, start_time, end_time, status, created_by`

---

## 你只需要做嘅
改造第 7 項「美容師選擇」。其他 11 項功能保持原樣運作。
