/**
 * 預約修改頁面 — 重新選擇時間/美容師/房間/儀器 (含三維防撞)
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Label, Select, Spinner, Alert } from 'flowbite-react';
import { ChevronLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';

const EditAppointmentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [appointment, setAppointment] = useState(null);

  const [formData, setFormData] = useState({
    staff_id: '',
    room_id: '',
    equipment_id: '',
    appointment_date: '',
    start_time: '',
  });
  const [conflicts, setConflicts] = useState({ staff: false, room: false, equip: false });
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [equipment, setEquipment] = useState([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data: appt } = await supabase.from('appointments').select('*, treatments(name), clients(name)').eq('id', id).single();
    if (!appt) { setError('找不到預約'); setLoading(false); return; }

    const [{ data: sData }, { data: rData }, { data: eData }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('rooms').select('*').eq('is_active', true),
      supabase.from('equipment').select('*').eq('is_active', true),
    ]);

    setAppointment(appt);
    setFormData({
      staff_id: appt.staff_id,
      room_id: appt.room_id,
      equipment_id: appt.equipment_id || '',
      appointment_date: appt.appointment_date,
      start_time: appt.start_time,
    });
    setStaff(sData || []);
    setRooms(rData || []);
    setEquipment(eData || []);
    setLoading(false);
  };

  const checkConflicts = async () => {
    if (!formData.appointment_date || !formData.start_time) return;
    const startTime = formData.start_time;
    const durationMin = appointment?.treatments?.duration_minutes || 60;
    const [h, m] = startTime.split(':').map(Number);
    const endDate = new Date(0, 0, 0, h, m + durationMin);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const { data: conflicting } = await supabase
      .from('appointments')
      .select('staff_id, room_id, equipment_id')
      .eq('appointment_date', formData.appointment_date)
      .neq('status', 'cancelled')
      .neq('id', id)
      .lt('start_time', endTime)
      .gt('end_time', startTime);

    if (conflicting) {
      setConflicts({
        staff: conflicting.some(c => c.staff_id === formData.staff_id),
        room: conflicting.some(c => c.room_id === formData.room_id),
        equip: formData.equipment_id ? conflicting.some(c => c.equipment_id === formData.equipment_id) : false,
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const startTime = formData.start_time;
    const durationMin = appointment?.treatments?.duration_minutes || 60;
    const [h, m] = startTime.split(':').map(Number);
    const endDate = new Date(0, 0, 0, h, m + durationMin);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const { error: saveErr } = await supabase.from('appointments').update({
      staff_id: formData.staff_id,
      room_id: formData.room_id,
      equipment_id: formData.equipment_id || null,
      appointment_date: formData.appointment_date,
      start_time: formData.start_time,
      end_time: endTime,
    }).eq('id', id);

    if (saveErr) {
      setError(saveErr.message);
    } else {
      navigate(-1);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;
  if (error && !appointment) return <Alert color="failure">{error}</Alert>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">修改預約</h1>
      </header>

      {error && <Alert color="failure">{error}</Alert>}

      {appointment && (
        <Card className="p-2">
          <div className="bg-bg p-4 rounded-xl mb-6 text-sm space-y-1">
            <p>客戶：<b>{appointment.clients?.name}</b></p>
            <p>療程：<b>{appointment.treatments?.name}</b> ({appointment.treatments?.duration_minutes || 60} 分鐘)</p>
            <p>狀態：<b>{appointment.status}</b></p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>日期</Label>
                <input type="date" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface focus:ring-primary focus:border-primary" value={formData.appointment_date} onChange={(e) => setFormData({...formData, appointment_date: e.target.value})} />
              </div>
              <div>
                <Label>時間</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00'].map(time => (
                    <button key={time} className={`py-2 text-sm rounded-lg border transition-all ${formData.start_time === time ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text hover:bg-primary-light/20'}`}
                      onClick={() => { setFormData({...formData, start_time: time}); checkConflicts(); }}>{time}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4 border-l pl-6">
              <div>
                <Label>美容師</Label>
                <Select value={formData.staff_id} onChange={(e) => setFormData({...formData, staff_id: e.target.value})}>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                {conflicts.staff && <p className="text-xs text-danger mt-1">⚠️ 該美容師此時段已有預約</p>}
              </div>
              <div>
                <Label>房間</Label>
                <Select value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
                {conflicts.room && <p className="text-xs text-danger mt-1">⚠️ 該房間此時段已被佔用</p>}
              </div>
              <div>
                <Label>儀器 (可選)</Label>
                <Select value={formData.equipment_id} onChange={(e) => setFormData({...formData, equipment_id: e.target.value})}>
                  <option value="">不選儀器</option>
                  {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <Button variant="secondary" onClick={() => navigate(-1)}>取消</Button>
            <Button variant="primary" loading={saving} disabled={conflicts.staff || conflicts.room} onClick={handleSave}>儲存變更</Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default EditAppointmentPage;
