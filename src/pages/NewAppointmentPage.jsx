/**
 * 預約建立表單頁面
 * 包含客戶搜尋、療程選擇、美容師/房間/儀器排期與防撞檢查
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
  ChevronRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';

const NewAppointmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    treatment_id: '',
    staff_id: '',
    room_id: '',
    equipment_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    remarks: ''
  });

  // Options State
  const [clients, setClients] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [conflicts, setConflicts] = useState({ staff: false, room: false, equip: false });
  const [schedules, setSchedules] = useState([]);  // 排班資料

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    const { data: tData } = await supabase.from('treatments').select('*');
    const { data: sData } = await supabase.from('profiles').select('*');
    const { data: rData } = await supabase.from('rooms').select('*');
    const { data: mData } = await supabase.from('equipment').select('*');

    setTreatments(tData || []);
    setStaff(sData || []);
    setRooms(rData || []);
    setEquipment(mData || []);
    // 載入排班資料
    const { data: schData } = await supabase.from('staff_schedules').select('*');
    setSchedules(schData || []);
  };

  // 根據排班取得該美容師可用的時間段
  const getAvailableTimes = () => {
    const allTimes = ['10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00'];
    if (!formData.staff_id || !formData.appointment_date) return allTimes;
    const day = new Date(formData.appointment_date).getDay();
    const staffSchedules = schedules.filter(s => s.staff_id === formData.staff_id && s.day_of_week === day);
    if (staffSchedules.length === 0) return allTimes; // 無排班資料 → 不阻擋
    // 過濾：只有時間在排班範圍內的才顯示
    return allTimes.filter(time => {
      return staffSchedules.some(sch => {
        if (sch.is_off) return false;
        return time >= sch.start_time && time < sch.end_time;
      });
    });
  };

  // 取得美容師當天排班狀態文字
  const getStaffScheduleLabel = (staffId) => {
    if (!formData.appointment_date) return '';
    const day = new Date(formData.appointment_date).getDay();
    const sch = schedules.find(s => s.staff_id === staffId && s.day_of_week === day);
    if (!sch) return '（無排班）';
    if (sch.is_off) return '（休假）';
    return `（${sch.start_time}-${sch.end_time}）`;
  };
  const checkConflicts = async () => {
    if (!formData.appointment_date || !formData.start_time) return;

    setLoading(true);

    const startTime = formData.start_time;
    // 計算結束時間 = startTime + 療程時長
    const treatment = treatments.find(t => t.id === formData.treatment_id);
    const durationMin = treatment?.duration_minutes || 60;
    const [h, m] = startTime.split(':').map(Number);
    const endDate = new Date(0, 0, 0, h, m + durationMin);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // 查詢該時段內是否有衝突預約 (排除 cancelled)
    const { data: conflicting } = await supabase
      .from('appointments')
      .select('staff_id, room_id, equipment_id')
      .eq('appointment_date', formData.appointment_date)
      .neq('status', 'cancelled')
      .lt('start_time', endTime)
      .gt('end_time', startTime);

    if (conflicting) {
      setConflicts({
        staff: conflicting.some(c => c.staff_id === formData.staff_id),
        room: conflicting.some(c => c.room_id === formData.room_id),
        equip: formData.equipment_id
          ? conflicting.some(c => c.equipment_id === formData.equipment_id)
          : false,
      });
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    // 計算 end_time
    const treatment = treatments.find(t => t.id === formData.treatment_id);
    const durationMin = treatment?.duration_minutes || 60;
    const [h, m] = formData.start_time.split(':').map(Number);
    const endDate = new Date(0, 0, 0, h, m + durationMin);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const { error } = await supabase.from('appointments').insert({
      client_id: formData.client_id,
      staff_id: formData.staff_id,
      treatment_id: formData.treatment_id,
      room_id: formData.room_id,
      equipment_id: formData.equipment_id || null,
      appointment_date: formData.appointment_date,
      start_time: formData.start_time,
      end_time: endTime,
      status: 'confirmed',
      created_by: (await supabase.auth.getUser()).data.user.id,
      remarks: formData.remarks,
    });

    if (!error) {
      navigate('/');
    } else {
      alert("儲存失敗: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">建立新預約</h1>
        <div className="ml-auto flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-3 h-3 rounded-full ${step >= s ? 'bg-primary' : 'bg-gray-200'}`} />
          ))}
        </div>
      </header>

      {step === 1 && (
        <Card className="p-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <UserPlusIcon className="w-6 h-6 text-primary" />
            第一步：選擇客戶與療程
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>搜尋客戶 (姓名/電話)</Label>
              <TextInput 
                placeholder="輸入姓名或電話..." 
                onChange={async (e) => {
                  if (e.target.value.length > 1) {
                    const val = e.target.value;
                    const { data } = await supabase.from('clients').select('*')
                      .or(`name.ilike.%${val}%,phone.ilike.%${val}%`);
                    setClients(data || []);
                  }
                }}
              />
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-xl p-2 bg-bg">
                {clients.map(c => (
                  <div 
                    key={c.id} 
                    className={`p-3 rounded-lg border cursor-pointer ${formData.client_id === c.id ? 'bg-primary text-white border-primary' : 'bg-white'}`}
                    onClick={() => setFormData({...formData, client_id: c.id})}
                  >
                    {c.name} ({c.phone.slice(-4)})
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>選擇預約療程</Label>
              <Select value={formData.treatment_id} onChange={(e) => setFormData({...formData, treatment_id: e.target.value})}>
                <option value="">請選擇療程...</option>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button disabled={!formData.client_id || !formData.treatment_id} onClick={() => setStep(2)}>
              下一步 <ChevronRightIcon className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <ClockIcon className="w-6 h-6 text-primary" />
            第二步：安排日期、美容師與房間
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>日期</Label>
                <input 
                  type="date" 
                  className="w-full border-gray-200 rounded-xl focus:ring-primary focus:border-primary"
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                />
              </div>
              <div>
                <Label>時間</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {getAvailableTimes().map(time => (
                    <button
                      key={time}
                      className={`py-2 text-sm rounded-lg border transition-all ${formData.start_time === time ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text hover:bg-primary-light/20'}`}
                      onClick={() => { setFormData({...formData, start_time: time}); checkConflicts(); }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 border-l pl-6">
              <div>
                <Label>美容師</Label>
                <Select value={formData.staff_id} onChange={(e) => setFormData({...formData, staff_id: e.target.value})}>
                  <option value="">選擇美容師</option>
                  {staff.map(s => {
                    const label = getStaffScheduleLabel(s.id);
                    const isOff = label.includes('休假');
                    return (
                      <option key={s.id} value={s.id} disabled={isOff}>
                        {s.name}{label ? ' ' + label : ''}
                      </option>
                    );
                  })}
                </Select>
                {conflicts.staff && <p className="text-xs text-danger mt-1">⚠️ 該美容師此時段已有預約</p>}
              </div>
              <div>
                <Label>房間</Label>
                <Select value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">選擇房間</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
                {conflicts.room && <p className="text-xs text-danger mt-1">⚠️ 該房間此時段已被佔用</p>}
              </div>
              <div>
                <Label>儀器 (非必填)</Label>
                <Select value={formData.equipment_id} onChange={(e) => setFormData({...formData, equipment_id: e.target.value})}>
                  <option value="">選擇儀器</option>
                  {equipment.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="secondary" onClick={() => setStep(1)}>上一步</Button>
            <Button disabled={!formData.staff_id || !formData.room_id || conflicts.staff || conflicts.room} onClick={() => setStep(3)}>
              下一步 <ChevronRightIcon className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 text-success rounded-full flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-bold">確認預約詳情</h3>
          <div className="bg-bg p-6 rounded-2xl text-left space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-text-muted">預約時間</span>
              <span className="font-bold">{formData.appointment_date} {formData.start_time}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-text-muted">客戶姓名</span>
              <span className="font-bold">{clients.find(c => c.id === formData.client_id)?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-text-muted">療程項目</span>
              <span className="font-bold">{treatments.find(t => t.id === formData.treatment_id)?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-text-muted">美容師</span>
              <span className="font-bold">{staff.find(s => s.id === formData.staff_id)?.name}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>返回修改</Button>
            <Button variant="primary" className="flex-1" loading={loading} onClick={handleSubmit}>儲存並發送通知</Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default NewAppointmentPage;
