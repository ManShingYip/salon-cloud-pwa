# 美容院管理系統 — 資料庫 ERD

> 可直接複製下方 PlantUML 程式碼到 [PlantUML Online](https://www.plantuml.com/plantuml/uml/) 或支援 PlantUML 的編輯器（VS Code + PlantUML 擴充）中即時預覽。

```plantuml
@startuml 美容院管理系統資料庫ERD

' ============================================================
' 美容院管理雲端系統 — 完整資料庫實體關係圖
' Supabase PostgreSQL + RLS + Custom Claims
' ============================================================

title 美容院管理系統 — 資料庫 ERD (Supabase PostgreSQL)

skinparam backgroundColor #FEFAF6
skinparam defaultFontName -apple-system, PingFang TC, sans-serif
skinparam roundCorner 12
skinparam linetype ortho

!define PRIMARY_COLOR #C88EA7
!define ENTITY_BG #FFFFFF
!define AUTH_COLOR #9B6B82
!define LOG_COLOR #D4736A
!define MONEY_COLOR #6B9B7D

' ============================================================
' AUTH 模組
' ============================================================
package "🔐 Auth & 權限" as AuthModule #FFFAF0 {

  entity "auth.users\n(Supabase 內建)" as auth_users <<E>> {
    * id : UUID <<PK>>
    --
    email : TEXT
    encrypted_password : TEXT
    raw_app_meta_data : JSONB
    created_at : TIMESTAMPTZ
  }

  entity "profiles\n(使用者角色)" as profiles #FFFFFF {
    * id : UUID <<PK, FK→auth.users>>
    --
    * business_id : UUID <<FK→businesses>>
    role : TEXT <<"shop_owner | staff">>
    name : TEXT
    phone : TEXT
    is_active : BOOLEAN
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
  }

  entity "staff_schedules\n(員工排班)" as staff_schedules #FFFFFF {
    * id : UUID <<PK>>
    --
    * staff_id : UUID <<FK→profiles>>
    day_of_week : INT <<0=日 1-6>>
    start_time : TIME
    end_time : TIME
    is_off : BOOLEAN
  }

  entity "businesses\n(店鋪 — 預留多店)" as businesses #FFFFFF {
    * id : UUID <<PK>>
    --
    name : TEXT
    address : TEXT
    phone : TEXT
    created_at : TIMESTAMPTZ
  }
}

' ============================================================
' 客戶模組
' ============================================================
package "👥 客戶管理" as ClientModule #FFF5F7 {

  entity "clients\n(客戶資料)" as clients #FFFFFF {
    * id : UUID <<PK>>
    --
    * business_id : UUID <<FK→businesses>>
    name : TEXT
    phone : TEXT
    member_id : TEXT <<"M 開頭自動編號">>
    source : TEXT <<"IG廣告 / 朋友介紹 / 街客…">>
    is_sensitive : BOOLEAN
    sensitive_note : TEXT
    remarks : TEXT
    last_visit_date : DATE
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
  }

  entity "client_services\n(客戶已購療程庫存)" as client_services #FFFFFF {
    * id : UUID <<PK>>
    --
    * client_id : UUID <<FK→clients>>
    * treatment_id : UUID <<FK→treatments>>
    total_sessions : INT
    remaining_sessions : INT
    purchase_date : DATE
    expiry_date : DATE
    unit_price : NUMERIC(10,2)
    status : TEXT <<"active | expired | refunded">>
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
  }
}

' ============================================================
' 療程模組
' ============================================================
package "💆 療程管理" as TreatmentModule #F5F9FF {

  entity "treatments\n(療程項目)" as treatments #FFFFFF {
    * id : UUID <<PK>>
    --
    * business_id : UUID <<FK→businesses>>
    name : TEXT
    category : TEXT
    single_price : NUMERIC(10,2)
    package_sessions : INT
    duration_minutes : INT
    description : TEXT
    is_active : BOOLEAN
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
  }
}

' ============================================================
' 預約模組
' ============================================================
package "📅 預約管理 (三維防撞)" as BookingModule #F0F7F4 {

  entity "rooms\n(房間)" as rooms #FFFFFF {
    * id : UUID <<PK>>
    --
    * business_id : UUID <<FK→businesses>>
    name : TEXT
    capacity : INT
    is_active : BOOLEAN
  }

  entity "equipment\n(儀器設備)" as equipment #FFFFFF {
    * id : UUID <<PK>>
    --
    * business_id : UUID <<FK→businesses>>
    name : TEXT
    total_quantity : INT
    is_active : BOOLEAN
  }

  entity "appointments\n(預約)" as appointments #FFFFFF {
    * id : UUID <<PK>>
    --
    * client_id : UUID <<FK→clients>>
    * staff_id : UUID <<FK→profiles>>
    * treatment_id : UUID <<FK→treatments>>
    * room_id : UUID <<FK→rooms>>
    * equipment_id : UUID <<FK→equipment>>
    appointment_date : DATE
    start_time : TIME
    end_time : TIME
    status : TEXT <<"confirmed | attended | cancelled | no_show">>
    no_show_count : INT <<DEFAULT 0>>
    remarks : TEXT
    created_by : UUID <<FK→profiles>>
    created_at : TIMESTAMPTZ
    updated_at : TIMESTAMPTZ
  }
}

' ============================================================
' 金流 / 結算模組
' ============================================================
package "💰 結算與金流" as MoneyModule #F9FFF5 {

  entity "payment_transactions\n(交易紀錄)" as payment_transactions #FFFFFF {
    * id : UUID <<PK>>
    --
    * appointment_id : UUID <<FK→appointments>>
    client_id : UUID <<FK→clients>>
    treatment_id : UUID <<FK→treatments>>
    staff_id : UUID <<FK→profiles>>
    amount : NUMERIC(10,2)
    payment_method : TEXT <<"cash | card | transfer | other">>
    transaction_date : DATE
    settled_by : UUID <<FK→profiles>>
    settlement_id : UUID <<FK→daily_settlements>>
    remarks : TEXT
    created_at : TIMESTAMPTZ
  }

  entity "daily_settlements\n(每日結算)" as daily_settlements #FFFFFF {
    * id : UUID <<PK>>
    --
    * business_id : UUID <<FK→businesses>>
    settlement_date : DATE
    total_amount : NUMERIC(10,2)
    cash_amount : NUMERIC(10,2)
    card_amount : NUMERIC(10,2)
    transfer_amount : NUMERIC(10,2)
    other_amount : NUMERIC(10,2)
    cash_difference : NUMERIC(10,2)
    difference_note : TEXT
    status : TEXT <<"pending | locked">>
    locked_by : UUID <<FK→profiles>>
    locked_at : TIMESTAMPTZ
    created_at : TIMESTAMPTZ
  }

  entity "refunds\n(退款紀錄)" as refunds #FFFFFF {
    * id : UUID <<PK>>
    --
    * client_service_id : UUID <<FK→client_services>>
    * refunded_by : UUID <<FK→profiles>>
    refund_amount : NUMERIC(10,2)
    restored_sessions : INT
    reason : TEXT
    refund_date : DATE
    created_at : TIMESTAMPTZ
  }
}

' ============================================================
' 日誌模組 (防篡改)
' ============================================================
package "📋 活動日誌 (INSERT-ONLY)" as LogModule #FFF0F0 {

  entity "activity_log\n(⛔ 禁止 UPDATE/DELETE)" as activity_log #FFF0F0 {
    * id : UUID <<PK>>
    --
    user_id : UUID <<FK→profiles>>
    action_type : TEXT <<"deduct | refund | create | update | cancel | settle | …">>
    target_type : TEXT <<"appointment | client | service | settlement">>
    target_id : UUID
    details : JSONB <<"變動前後資料對照">>
    ip_address : INET
    created_at : TIMESTAMPTZ
    --
    == RLS POLICY ==
    INSERT: SECURITY DEFINER 函式
    UPDATE: USING (false)
    DELETE: USING (false)
  }
}

' ============================================================
' 關係線
' ============================================================

' Auth 關係
auth_users ||--|| profiles : "1:1 (id = id)"
profiles }|--|| businesses : "多 隸屬 1"
profiles ||--o{ staff_schedules : "排班"
profiles ||--o{ appointments : "服務 (staff_id)"
profiles ||--o{ appointments : "建立 (created_by)"

' 客戶關係
businesses ||--o{ clients : "擁有"
clients ||--o{ client_services : "購買"
clients ||--o{ appointments : "預約"
clients ||--o{ payment_transactions : "付款"

' 療程
businesses ||--o{ treatments : "提供"
treatments ||--o{ client_services : "被購買"
treatments ||--o{ appointments : "被預約"
treatments ||--o{ payment_transactions : "被結算"

' 資源
businesses ||--o{ rooms : "擁有"
businesses ||--o{ equipment : "擁有"
rooms ||--o{ appointments : "佔用"
equipment ||--o{ appointments : "佔用"

' 結算
profiles ||--o{ payment_transactions : "結算 (settled_by)"
appointments ||--o{ payment_transactions : "產生"
profiles ||--o{ daily_settlements : "鎖定 (locked_by)"
businesses ||--o{ daily_settlements : "結算"
payment_transactions }o--|| daily_settlements : "歸屬 (settlement_id)"

' 退款
profiles ||--o{ refunds : "執行 (refunded_by)"
client_services ||--o{ refunds : "被退款"

' 日誌 (所有變動都寫入)
profiles ||--o{ activity_log : "操作 (user_id)"

' 三維防撞 — 視覺標示
note right of appointments
  <b>🔴 三維防撞約束</b>
  同一時段 (date + time range) 內：
  • staff_id 不得重複
  • room_id 不得重複
  • equipment_id 不得重複

  實作方式：
  Supabase RPC 函式
  check_appointment_conflict()
end note

note right of activity_log
  <b>🛡️ 防篡改設計</b>
  • RLS: UPDATE USING (false)
  • RLS: DELETE USING (false)
  • 僅允許 SECURITY DEFINER
    觸發器 / RPC 寫入
  • 即使有 DB 密碼也無法
    從後台修改或刪除
end note

note right of client_services
  <b>🔒 扣數防弊</b>
  • 前端不可直接 UPDATE
    remaining_sessions
  • 只能透過 RPC
    deduct_service()
    在 Transaction 中扣減
  • 同時寫入 activity_log
end note

@enduml
```

---

## 📊 快速總覽

### 12 張核心資料表

| 模組 | 表名 | 用途 |
|------|------|------|
| 🔐 Auth | `auth.users` | Supabase 內建認證 |
| 🔐 Auth | `profiles` | 使用者角色 (shop_owner / staff) |
| 🔐 Auth | `staff_schedules` | 員工排班 |
| 🔐 Auth | `businesses` | 店鋪（預留多店） |
| 👥 客戶 | `clients` | 客戶資料 + 標籤 + 來源 |
| 👥 客戶 | `client_services` | 客戶已購療程庫存（剩餘次數） |
| 💆 療程 | `treatments` | 療程項目 + 單價 |
| 📅 預約 | `rooms` | 房間 |
| 📅 預約 | `equipment` | 儀器設備 |
| 📅 預約 | `appointments` | 預約核心（三維防撞） |
| 💰 金流 | `payment_transactions` | 交易紀錄 |
| 💰 金流 | `daily_settlements` | 每日結算（可鎖定） |
| 💰 金流 | `refunds` | 退款紀錄 |
| 📋 日誌 | `activity_log` | **INSERT-ONLY** 活動日誌 |

### 🔴 三大安全機制

1. **三維防撞** — 同一時段 staff + room + equipment 不得衝突
2. **防篡改 Log** — RLS `UPDATE USING (false)` `DELETE USING (false)`
3. **扣數防弊** — 前端不可直接 UPDATE `remaining_sessions`，只能透過 SECURITY DEFINER RPC
