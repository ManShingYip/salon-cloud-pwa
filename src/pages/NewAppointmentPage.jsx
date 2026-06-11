/**
 * 預約建立表單頁面 — 單頁版
 * 客戶搜尋、療程選擇、美容師/房間/儀器、時間、三維防撞
 */
import React, { useState, useEffect } from 'react';
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
  const [rooms, setRooms] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);

  // 表單
  const [form, setForm] = useState({
    client_id: '',
    treatment_id: '',
    staff_id: '',
    room_id: '',
    equipment_id: '',
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
      const [{ data: tData }, { data: sData }, { data: rData }, { data: eData }, { data: schData }] = await Promise.all([
        supabase.from('treatments').select('*').eq('is_active', true),
        supabase.from('profiles').select('*'),
        supabase.from('rooms').select('*').eq('is_active', true),
        supabase.from('equipment').select('*').eq('is_active', true),
        supabase.from('staff_schedules').select('*'),
      ]);
      setTreatments(tData || []);
      setStaff(sData || []);
      setRooms(rData || []);
      setEquipment(eData || []);
      setSchedules(schData || []);
    };
    load();
  }, []);

  // 排班提示
  const getScheduleHint = (staffId) => {
    const day = new Date(form.appointment_date).getDay();
    const sch = schedules.find(s => s.staff_id === staffId && s.day_of_week === day);
    if (!sch) return '（無排班）';
    if (sch.is_off) return '（休假）';
    return `（${sch.start_time}-${sch.end_time}）`;
  };

  // 衝突檢查
  const checkConflicts = () => {
    setConflictMsg(null);
    if (!form.appointment_date || !form.start_time || !form.staff_id || !form.room_id) return true;
    const endTime = getEndTime();
    supabase.from('appointments')
      .select('staff_id, room_id, equipment_id')
      .eq('appointment_date', form.appointment_date)
      .neq('status', 'cancelled')
      .lt('start_time', endTime)
      .gt('end_time', form.start_time)
      .then(({ data: conflicting }) => {
        if (!conflicting?.length) return;
        const msgs = [];
        if (conflicting.some(c => c.staff_id === form.staff_id)) msgs.push('美容師');
        if (conflicting.some(c => c.room_id === form.room_id)) msgs.push('房間');
        if (form.equipment_id && conflicting.some(c => c.equipment_id === form.equipment_id)) msgs.push('儀器');
        if (msgs.length) setConflictMsg(`⚠️ ${msgs.join('、')}此時段已有預約`);
      });
    return true;
  };

  // 送出
  const handleSubmit = async () => {
    if (!form.client_id || !form.treatment_id || !form.staff_id || !form.room_id) return;
    setLoading(true);
    const endTime = getEndTime();
    const { error } = await supabase.from('appointments').insert({
      client_id: form.client_id,
      staff_id: form.staff_id,
      treatment_id: form.treatment_id,
      room_id: form.room_id,
      equipment_id: form.equipment_id || null,
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">建立新預約</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左欄 */}
        <div className="space-y-4">
          <Card className="p-2">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <UserPlusIcon className="w-6 h-6 text-primary" /> 客戶與療程
            </h3>
            {/* 客戶搜尋 */}
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
                      onClick={() => {
                        setForm({ ...form, client_id: c.id });
                        setClients([]);
                      }}
                    >
                      {c.name} · {c.phone.slice(-4)} {c.member_id ? '· ' + c.member_id : ''}
                    </div>
                  ))}
                </div>
              )}
              {/* 已選客戶 */}
              {form.client_id && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm">
                  <CheckCircleIcon className="w-5 h-5 text-success" />
                  <b>{clients.find(c => c.id === form.client_id)?.name || selectedClient?.name || '已選擇'}</b>
                </div>
              )}
            </div>
            {/* 療程選擇 */}
            <div>
              <Label>療程項目</Label>
              <Select value={form.treatment_id} onChange={(e) => setForm({...form, treatment_id: e.target.value})}>
                <option value="">請選擇...</option>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name} ({t.duration_minutes}分 · HK${t.single_price})</option>)}
              </Select>
            </div>
          </Card>

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
          <Card className="p-2">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <HomeIcon className="w-6 h-6 text-primary" /> 資源安排
            </h3>
            <div className="space-y-4">
              <div>
                <Label>美容師</Label>
                <Select value={form.staff_id} onChange={(e) => { setForm({...form, staff_id: e.target.value}); checkConflicts(); }}>
                  <option value="">選擇美容師</option>
                  {staff.map(s => {
                    const hint = getScheduleHint(s.id);
                    const off = hint.includes('休假');
                    return <option key={s.id} value={s.id} disabled={off}>{s.name} {hint}</option>;
                  })}
                </Select>
              </div>
              <div>
                <Label>房間</Label>
                <Select value={form.room_id} onChange={(e) => { setForm({...form, room_id: e.target.value}); checkConflicts(); }}>
                  <option value="">選擇房間</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>儀器 (非必填)</Label>
                <Select value={form.equipment_id} onChange={(e) => { setForm({...form, equipment_id: e.target.value}); checkConflicts(); }}>
                  <option value="">不選儀器</option>
                  {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          {/* 衝突提示 */}
          {conflictMsg && (
            <Alert color="warning" icon={ExclamationTriangleIcon}>
              {conflictMsg}
            </Alert>
          )}

          {/* 預覽摘要 */}
          {(form.client_id || form.treatment_id) && (
            <Card className="p-2 bg-bg">
              <h3 className="font-bold mb-3 text-sm">預約摘要</h3>
              <div className="space-y-2 text-sm">
                {selectedClient && <p>👤 {selectedClient.name} · {selectedClient.phone}</p>}
                {selectedTreatment && <p>💆 {selectedTreatment.name} (HK${selectedTreatment.single_price} · {selectedTreatment.duration_minutes}分)</p>}
                {form.staff_id && <p>👩 {staff.find(s => s.id === form.staff_id)?.name}</p>}
                {form.room_id && <p>🚪 {rooms.find(r => r.id === form.room_id)?.name}</p>}
                <p>📅 {form.appointment_date} {form.start_time} - {getEndTime()}</p>
              </div>
            </Card>
          )}

          {/* 送出按鈕 */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!form.client_id || !form.treatment_id || !form.staff_id || !form.room_id}
            loading={loading}
            onClick={handleSubmit}
          >
            建立預約
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewAppointmentPage;
