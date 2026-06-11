/**
 * 預約建立表單頁面 v2
 * 客戶搜尋、療程選擇、美容師 Grid Cards、自由輸入房間/儀器、三維防撞
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, Select, Label, Card, Spinner, Alert } from 'flowbite-react';
import {
  UserPlusIcon,
  SparklesIcon,
  ClockIcon,
  HomeIcon,
  WrenchIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';

const NewAppointmentPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [conflictMsg, setConflictMsg] = useState(null);
  const [success, setSuccess] = useState(false);

  // 選項資料
  const [treatments, setTreatments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);
  const [staffAppointments, setStaffAppointments] = useState([]);

  // 表單
  const [form, setForm] = useState({
    client_id: '',
    treatment_id: '',
    staff_id: '',
    room_name: '',
    equipment_name: '',
    appointment_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
  });

  // 計算結束時間
  const getEndTime = () => {
    const t = treatments.find(tx => tx.id === form.treatment_id);
    const dur = t?.duration_minutes || 60;
    const [h, m] = form.start_time.split(':').map(Number);
    const end = new Date(0, 0, 0, h, m + dur);
    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: tData }, { data: sData }, { data: schData }] = await Promise.all([
        supabase.from('treatments').select('*').eq('is_active', true),
        supabase.from('staff').select('*'),
        supabase.from('staff_schedules').select('*'),
      ]);
      setTreatments(tData || []);
      setStaff(sData || []);
      setSchedules(schData || []);
    };
    load();
  }, []);

  // 改日期 → 重新查當日 appointments
  useEffect(() => {
    if (!form.appointment_date) return;
    supabase.from('appointments')
      .select('staff_id, start_time, end_time')
      .eq('appointment_date', form.appointment_date)
      .neq('status', 'cancelled')
      .then(({ data }) => setStaffAppointments(data || []));
  }, [form.appointment_date]);

  // ─── 美容師狀態計算 ───────────────────────────
  const staffStatuses = useMemo(() => {
    const day = new Date(form.appointment_date).getDay();
    const endTime = getEndTime();

    return staff.map(s => {
      const sch = schedules.find(sc => sc.staff_id === s.id && sc.day_of_week === day);

      // 冇排班 or 休假
      if (!sch || sch.is_off) {
        return { ...s, status: 'off', label: '休假', hint: '', disabled: true };
      }

      // 時間重疊檢查
      const hasConflict = staffAppointments.some(a =>
        a.staff_id === s.id &&
        a.start_time < endTime &&
        a.end_time > form.start_time
      );

      if (hasConflict) {
        return { ...s, status: 'busy', label: '已佔用', hint: '', disabled: true };
      }

      return {
        ...s,
        status: 'available',
        label: '可預約',
        hint: `${sch.start_time?.slice(0, 5)} - ${sch.end_time?.slice(0, 5)}`,
        disabled: false,
      };
    });
  }, [staff, schedules, form.appointment_date, form.start_time, staffAppointments, getEndTime]);

  // ─── 衝突檢查 ─────────────────────────────────
  const checkConflicts = () => {
    setConflictMsg(null);
    if (!form.appointment_date || !form.start_time || !form.staff_id || !form.room_name) return;
    const endTime = getEndTime();
    supabase.from('appointments')
      .select('staff_id, room_name, equipment_name')
      .eq('appointment_date', form.appointment_date)
      .neq('status', 'cancelled')
      .lt('start_time', endTime)
      .gt('end_time', form.start_time)
      .then(({ data: conflicting }) => {
        if (!conflicting?.length) return;
        const msgs = [];
        if (conflicting.some(c => c.staff_id === form.staff_id)) msgs.push('美容師');
        if (form.room_name && conflicting.some(c => c.room_name === form.room_name)) msgs.push('房間');
        if (form.equipment_name && conflicting.some(c => c.equipment_name === form.equipment_name)) msgs.push('儀器');
        if (msgs.length) setConflictMsg(`⚠️ ${msgs.join('、')}此時段已有預約`);
      });
  };

  // 選美容師/房間時觸發衝突檢查
  useEffect(() => {
    if (form.staff_id && form.room_name) checkConflicts();
  }, [form.staff_id, form.room_name, form.equipment_name]);

  // ─── 送出 ─────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.client_id || !form.treatment_id || !form.staff_id || !form.room_name) return;
    setLoading(true);
    const endTime = getEndTime();
    const { error } = await supabase.from('appointments').insert({
      client_id: form.client_id,
      staff_id: form.staff_id,
      treatment_id: form.treatment_id,
      room_name: form.room_name,
      equipment_name: form.equipment_name || null,
      appointment_date: form.appointment_date,
      start_time: form.start_time,
      end_time: endTime,
      status: 'confirmed',
      created_by: (await supabase.auth.getUser()).data.user.id,
    });
    if (error) {
      alert('建立失敗: ' + error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 1000);
    }
    setLoading(false);
  };

  const selectedClient = clients.find(c => c.id === form.client_id);
  const selectedTreatment = treatments.find(t => t.id === form.treatment_id);
  const selectedStaff = staff.find(s => s.id === form.staff_id);

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-20 h-20 bg-green-100 text-success rounded-full flex items-center justify-center mb-6">
          <CheckCircleIcon className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold">預約已建立</h2>
        <p className="text-text-muted mt-2">即將返回...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex items-center gap-4 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">建立新預約</h1>
      </header>

      <div className="flex-1 overflow-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左欄 */}
          <div className="space-y-4">
            {/* ① 客戶與療程 */}
            <Card className="p-2">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <UserPlusIcon className="w-6 h-6 text-primary" /> 客戶與療程
              </h3>
              <div className="space-y-2 mb-4">
                <Label>搜尋客戶 (姓名 / 電話)</Label>
                <TextInput
                  placeholder="輸入姓名或電話搜尋..."
                  onChange={async (e) => {
                    if (e.target.value.length > 1) {
                      const { data } = await supabase.from('clients').select('*')
                        .or(`name.ilike.%${e.target.value}%,phone.ilike.%${e.target.value}%`);
                      setClients(data || []);
                    } else { setClients([]); }
                  }}
                />
                {clients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-xl p-2 bg-bg space-y-1">
                    {clients.map(c => (
                      <div
                        key={c.id}
                        className={`p-3 rounded-lg border cursor-pointer ${form.client_id === c.id ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-primary-light/20'}`}
                        onClick={() => { setForm({ ...form, client_id: c.id }); setClients([]); }}
                      >
                        {c.name} · {c.phone.slice(-4)} {c.member_id ? '· ' + c.member_id : ''}
                        {c.is_sensitive && <span className="ml-2 text-xs bg-danger/20 text-danger px-2 py-0.5 rounded-full">⚠️ 敏感</span>}
                      </div>
                    ))}
                  </div>
                )}
                {form.client_id && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <b>{selectedClient?.name || '已選擇'}</b>
                    {selectedClient?.is_sensitive && <span className="text-xs text-danger font-bold">⚠️ 特殊敏感客戶</span>}
                  </div>
                )}
              </div>
              <div>
                <Label>療程項目</Label>
                <Select value={form.treatment_id} onChange={(e) => setForm({...form, treatment_id: e.target.value})}>
                  <option value="">請選擇...</option>
                  {treatments.map(t => <option key={t.id} value={t.id}>{t.name} ({t.duration_minutes}分 · HK${t.single_price})</option>)}
                </Select>
              </div>
            </Card>

            {/* ② 時間 */}
            <Card className="p-2">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <ClockIcon className="w-6 h-6 text-primary" /> 時間
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>日期</Label>
                  <input type="date" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface" value={form.appointment_date} onChange={(e) => setForm({...form, appointment_date: e.target.value})} />
                </div>
                <div>
                  <Label>開始時間</Label>
                  <input type="time" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} />
                </div>
              </div>
              {selectedTreatment && (
                <p className="text-xs text-text-muted mt-3">
                  預計結束時間：<b>{getEndTime()}</b>（療程時長 {selectedTreatment.duration_minutes} 分鐘）
                </p>
              )}
            </Card>
          </div>

          {/* 右欄 */}
          <div className="space-y-4">
            {/* ③ 美容師 Grid Cards */}
            <Card className="p-2">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <UserIcon className="w-6 h-6 text-primary" /> 美容師
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {staffStatuses.map(s => {
                  const isActive = form.staff_id === s.id;
                  if (s.status === 'off') return (
                    <div key={s.id} className="border border-gray-100 bg-gray-50/60 rounded-xl p-3 flex items-center gap-3 opacity-50 cursor-not-allowed">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-sm">{s.name?.[0]}</div>
                      <div><span className="font-bold text-text text-sm">{s.name}</span><span className="block text-xs text-danger">🏖️ 休假</span></div>
                    </div>
                  );
                  if (s.status === 'busy') return (
                    <div key={s.id} className="border-2 border-amber-300 bg-amber-50/50 rounded-xl p-3 flex items-center gap-3 opacity-70 cursor-not-allowed">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">{s.name?.[0]}</div>
                      <div><span className="font-bold text-text text-sm">{s.name}</span><span className="block text-xs text-warning">⚠️ 已佔用</span></div>
                    </div>
                  );
                  return (
                    <button
                      key={s.id}
                      onClick={() => setForm({...form, staff_id: isActive ? '' : s.id})}
                      className={`text-left border-2 rounded-xl p-3 flex items-center gap-3 transition-all
                        ${isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-100 bg-white hover:border-primary/30 hover:shadow-sm'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-primary text-white' : 'bg-bg text-text'}`}>
                        {isActive ? <CheckCircleIcon className="w-5 h-5" /> : s.name?.[0]}
                      </div>
                      <div>
                        <span className="font-bold text-text text-sm">{s.name}</span>
                        <span className="block text-xs text-text-muted">{s.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-text-muted mt-2">根據 {form.appointment_date} {form.start_time} 即時更新</p>
            </Card>

            {/* ④ 房間 + 儀器 — 自由文字輸入 */}
            <Card className="p-2">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <HomeIcon className="w-6 h-6 text-primary" /> 房間與儀器
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>房間 <span className="text-danger">*</span></Label>
                  <TextInput
                    placeholder="輸入房間名稱，例：Room A / VIP 房..."
                    value={form.room_name}
                    onChange={(e) => setForm({...form, room_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>儀器 (非必填)</Label>
                  <TextInput
                    placeholder="輸入儀器名稱，例：冰點激光儀..."
                    value={form.equipment_name}
                    onChange={(e) => setForm({...form, equipment_name: e.target.value})}
                  />
                </div>
              </div>
            </Card>

            {/* ⚠️ 衝突提示 */}
            {conflictMsg && (
              <Alert color="warning" icon={ExclamationTriangleIcon}>
                {conflictMsg}
              </Alert>
            )}

            {/* 📋 預約摘要 */}
            {(form.client_id || form.treatment_id) && (
              <Card className="p-2 bg-bg">
                <h3 className="font-bold mb-3 text-sm">預約摘要</h3>
                <div className="space-y-2 text-sm">
                  {selectedClient && <p>👤 {selectedClient.name} · {selectedClient.phone}</p>}
                  {selectedTreatment && <p>💆 {selectedTreatment.name} (HK${selectedTreatment.single_price} · {selectedTreatment.duration_minutes}分)</p>}
                  {selectedStaff && <p>👩 {selectedStaff.name}</p>}
                  {form.room_name && <p>🚪 {form.room_name}</p>}
                  {form.equipment_name && <p>🔧 {form.equipment_name}</p>}
                  <p>📅 {form.appointment_date} {form.start_time} - {getEndTime()}</p>
                </div>
              </Card>
            )}

            {/* 建立按鈕 */}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!form.client_id || !form.treatment_id || !form.staff_id || !form.room_name}
              loading={loading}
              onClick={handleSubmit}
            >
              建立預約
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAppointmentPage;
