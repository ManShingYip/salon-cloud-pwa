/**
 * 今日預約總覽頁面 v3 — 雙層視覺架構
 * 左側 25%：智慧日曆 (熱力圖) + 統計
 * 右側 75%：每日框架 + 橫向資料卡 (無限捲動)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, Spinner, Alert } from 'flowbite-react';
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  PlusIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserIcon,
  SparklesIcon,
  ArrowUturnLeftIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parseISO, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Tag from '@/components/ui/Tag';
import PaymentModal from '@/components/treatments/PaymentModal';

const DailyAppointmentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookedDays, setBookedDays] = useState([]);
  const [bookedCounts, setBookedCounts] = useState({});

  // 一週預約資料（含今天前後各 3 天）
  const [weekAppointments, setWeekAppointments] = useState({});
  const [refMonth, setRefMonth] = useState(new Date());

  // Payment/退回 Modal
  const [showPayment, setShowPayment] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [sensitiveAlert, setSensitiveAlert] = useState(null);
  const [showRevert, setShowRevert] = useState(false);
  const [revertAppointment, setRevertAppointment] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // 載入本月熱力圖 + 附近 7 天預約明細
  useEffect(() => {
    loadMonthHotmap();
    loadWeekAppointments();
  }, [selectedDate]);

  const loadMonthHotmap = async () => {
    const ref = new Date(selectedDate);
    const first = format(startOfMonth(ref), 'yyyy-MM-dd');
    const last = format(endOfMonth(ref), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('appointment_date')
      .gte('appointment_date', first)
      .lte('appointment_date', last)
      .neq('status', 'cancelled');
    if (data) {
      const counts = {};
      data.forEach(r => { counts[r.appointment_date] = (counts[r.appointment_date] || 0) + 1; });
      setBookedDays([...new Set(data.map(r => r.appointment_date))]);
      setBookedCounts(counts);
    }
    setRefMonth(ref);
  };

  const loadWeekAppointments = async () => {
    setLoading(true);
    const start = new Date(selectedDate);
    const dates = [];
    for (let i = -3; i <= 3; i++) {
      dates.push(format(addDays(start, i), 'yyyy-MM-dd'));
    }
    const firstDay = dates[0];
    const lastDay = dates[dates.length - 1];
    const { data } = await supabase
      .from('appointments')
      .select(`*, clients(name, phone, member_id, is_sensitive, sensitive_note), treatments(name), profiles!appointments_staff_id_fkey(name), rooms(name)`)
      .gte('appointment_date', firstDay)
      .lte('appointment_date', lastDay)
      .order('start_time', { ascending: true });

    const map = {};
    data?.forEach(a => {
      if (!map[a.appointment_date]) map[a.appointment_date] = [];
      map[a.appointment_date].push(a);
    });
    setWeekAppointments(map);
    setLoading(false);
  };

  // 操作按鈕
  const handleStatusChange = (app) => {
    if (app.clients?.is_sensitive) {
      setSensitiveAlert({ clientName: app.clients.name, note: app.clients.sensitive_note || '此客戶被標記為特殊敏感，請在服務時特別注意。' });
    }
    setSelectedAppointment(app);
    setShowPayment(true);
  };

  const handleRevert = async () => {
    if (!revertReason.trim()) return;
    setReverting(true);
    const { error } = await supabase.rpc('revert_attended_to_confirmed', { p_appointment_id: revertAppointment.id, p_reason: revertReason.trim() });
    if (error) { alert('退回失敗: ' + error.message); }
    else { setShowRevert(false); setRevertAppointment(null); setRevertReason(''); loadWeekAppointments(); }
    setReverting(false);
  };

  const cancelAppointment = async (id) => {
    if (confirm('確定取消此預約？')) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
      loadWeekAppointments();
    }
  };

  const markNoShow = async (id) => {
    if (confirm('確定標示此預約為失約？\n失約次數會自動累計。')) {
      await supabase.from('appointments').update({ status: 'no_show' }).eq('id', id);
      loadWeekAppointments();
    }
  };

  // 產生附近 7 天的日期陣列
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    const arr = [];
    for (let i = -3; i <= 3; i++) {
      const d = addDays(start, i);
      arr.push({ date: format(d, 'yyyy-MM-dd'), label: format(d, 'MM/dd (E)', { locale: zhHK }) });
    }
    return arr;
  }, [selectedDate]);

  // 當天篩選過的 appointments
  const todayApps = weekAppointments[selectedDate] || [];

  const dayStats = (apps) => ({
    total: apps.length,
    attended: apps.filter(a => a.status === 'attended').length,
    pending: apps.filter(a => a.status === 'confirmed').length,
    noShow: apps.filter(a => a.status === 'no_show').length,
  });
  const stats = dayStats(todayApps);

  return (
    <div className="flex flex-col h-full gap-4">
      {sensitiveAlert && (
        <Alert color="warning" icon={ExclamationTriangleIcon} onDismiss={() => setSensitiveAlert(null)}>
          <b>⚠️ 特殊敏感客戶：{sensitiveAlert.clientName}</b><br />{sensitiveAlert.note}
        </Alert>
      )}

      {/* 頂部 */}
      <header className="flex items-center gap-4 bg-surface p-4 rounded-2xl shadow-card">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput placeholder="搜尋客戶姓名、電話..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 text-primary font-bold px-4 border-l">
          <CalendarIcon className="w-6 h-6" />
          <span>{selectedDate}</span>
        </div>
      </header>

      {/* 雙層主體 */}
      <div className="flex flex-1 gap-6 min-h-0">
        {/* 左側 25%：日曆 + 統計 */}
        <aside className="w-[260px] flex flex-col gap-4 overflow-y-auto shrink-0">
          <div className="bg-surface rounded-2xl p-4 shadow-card">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-sm"><CalendarIcon className="w-5 h-5 text-primary" />預約日曆</h3>
            <DayPicker
              mode="single"
              month={refMonth}
              onMonthChange={setRefMonth}
              selected={parseISO(selectedDate)}
              onSelect={(day) => { if (day) setSelectedDate(format(day, 'yyyy-MM-dd')); }}
              locale={zhHK}
              components={{
                DayButton: ({ day, modifiers, ...buttonProps }) => {
                  const ds = day?.isoDate || '';
                  const count = bookedCounts[ds] || 0;
                  return (
                    <button {...buttonProps} type="button" className="rdp-day_button w-full h-full min-h-[44px]">
                      <div className="flex flex-col items-center leading-tight">
                        <span className={`text-sm ${count > 0 ? 'font-extrabold text-primary' : ''}`}>{day.date.getDate()}</span>
                        {count > 0 && <span className="text-[9px] text-primary font-semibold">{count}筆</span>}
                      </div>
                    </button>
                  );
                },
              }}
              className="w-full flex justify-center"
            />
          </div>
          <div className="bg-surface rounded-2xl p-4 shadow-card space-y-3">
            <h3 className="font-bold text-sm">當日統計</h3>
            <div className="bg-bg p-3 rounded-xl"><span className="text-xs text-text-muted block">總預約</span><span className="text-2xl font-bold text-primary">{stats.total}</span></div>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-50 p-3 rounded-xl text-center"><span className="text-xs text-success block">已出席</span><span className="text-lg font-bold">{stats.attended}</span></div>
              <div className="flex-1 bg-amber-50 p-3 rounded-xl text-center"><span className="text-xs text-warning block">待處理</span><span className="text-lg font-bold">{stats.pending}</span></div>
              {stats.noShow > 0 && <div className="flex-1 bg-red-50 p-3 rounded-xl text-center"><span className="text-xs text-danger block">失約</span><span className="text-lg font-bold text-danger">{stats.noShow}</span></div>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" icon={PlusIcon} className="flex-1" onClick={() => navigate('/appointments/new')}>新增預約</Button>
          </div>
        </aside>

        {/* 右側 75%：每天一個框架，垂直滑動 */}
        <section className="flex-1 overflow-y-auto space-y-4 pr-2">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="xl" /></div>
          ) : (
            weekDays.map(({ date, label }) => {
              const apps = weekAppointments[date] || [];
              const st = dayStats(apps);
              const isSelected = date === selectedDate;
              return (
                <div key={date} id={`day-${date}`} className={`rounded-2xl border-2 overflow-hidden transition-all ${isSelected ? 'border-primary shadow-lg' : 'border-gray-100 bg-surface'}`}>
                  {/* 日期標題列 */}
                  <div className={`p-4 flex items-center justify-between ${isSelected ? 'bg-primary text-white' : 'bg-bg'}`}>
                    <h3 className="font-bold text-lg">{label}</h3>
                    <div className="flex gap-2 text-sm">
                      <span>{st.total} 個預約</span>
                      {st.attended > 0 && <span className="text-green-300">✅{st.attended}</span>}
                      {st.pending > 0 && <span className="text-amber-300">⏳{st.pending}</span>}
                    </div>
                  </div>

                  {/* 橫向資料卡 */}
                  <div className="p-3 space-y-2">
                    {apps.length === 0 ? (
                      <p className="text-center py-8 text-text-muted text-sm">尚無預約</p>
                    ) : (
                      apps.filter(a => !searchQuery || (a.clients?.name || '').includes(searchQuery) || (a.clients?.phone || '').includes(searchQuery)).map(app => (
                        <div key={app.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            app.status === 'attended' ? 'bg-gray-50 border-transparent opacity-60' :
                            app.status === 'no_show' ? 'bg-red-50/30 border-red-100' : 'bg-white border-gray-100'
                          }`}
                        >
                          {/* 時間 */}
                          <div className="w-[90px] shrink-0 text-center border-r pr-3">
                            <span className="text-base font-bold text-text">{app.start_time}</span>
                            <span className="block text-[10px] text-text-muted">~{app.end_time}</span>
                          </div>
                          {/* 客戶 */}
                          <div className="w-[120px] shrink-0">
                            <span className="font-bold text-sm">
                              {app.clients?.name}
                              {app.clients?.is_sensitive && <ExclamationTriangleIcon className="w-4 h-4 text-danger inline ml-1" />}
                            </span>
                            <span className="block text-[11px] text-text-muted">{app.clients?.phone?.slice(-4) || '----'}</span>
                          </div>
                          {/* 療程 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-sm"><SparklesIcon className="w-4 h-4 text-primary shrink-0" /><span className="truncate">{app.treatments?.name}</span></div>
                          </div>
                          {/* 員工 + 房間 */}
                          <div className="w-[140px] shrink-0 flex flex-col text-xs text-text-muted">
                            <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{app.profiles?.name}</span>
                            <span className="flex items-center gap-1"><MapPinIcon className="w-3 h-3" />{app.rooms?.name}</span>
                          </div>
                          {/* 狀態 + 操作 */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Tag color={app.status === 'attended' ? 'green' : app.status === 'no_show' ? 'rose' : app.status === 'cancelled' ? 'gray' : 'amber'}>
                              {app.status === 'attended' ? '已出席' : app.status === 'no_show' ? '失約' : app.status === 'cancelled' ? '已取消' : '已確認'}
                            </Tag>
                            {app.no_show_count >= 2 && app.status !== 'attended' && <Tag color="rose">⚠️{app.no_show_count}</Tag>}
                            {app.status === 'attended' && (
                              <Button variant="secondary" size="xs" icon={ArrowUturnLeftIcon} onClick={(e) => { e.stopPropagation(); setRevertAppointment(app); setRevertReason(''); setShowRevert(true); }} />
                            )}
                            {app.status === 'confirmed' && (
                              <Button variant="secondary" size="xs" onClick={(e) => { e.stopPropagation(); handleStatusChange(app); }}>支付</Button>
                            )}
                            {app.status === 'confirmed' && (
                              <div className="flex gap-1">
                                <button className="text-[10px] text-danger hover:underline" onClick={(e) => { e.stopPropagation(); markNoShow(app.id); }}>失約</button>
                                <button className="text-[10px] text-text-muted hover:underline" onClick={(e) => { e.stopPropagation(); cancelAppointment(app.id); }}>取消</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* Payment Modal (Appointment 模式) */}
      {selectedAppointment && (
        <PaymentModal
          mode="appointment"
          show={showPayment}
          onClose={() => { setShowPayment(false); setSensitiveAlert(null); loadWeekAppointments(); }}
          appointment={selectedAppointment}
        />
      )}

      {/* 退回 Modal */}
      <Modal show={showRevert} onClose={() => setShowRevert(false)} title="🔙 退回已出席"
        footer={<><Button variant="secondary" onClick={() => setShowRevert(false)}>取消</Button><Button variant="danger" disabled={!revertReason.trim()} loading={reverting} onClick={handleRevert}>確認退回</Button></>}
      >
        <div className="space-y-4">
          <Alert color="warning"><b>⚠️ 此操作將：</b><br />1. 回補已支付的療程次數<br />2. 標記交易為 VOID<br />3. 預約狀態回到「已確認」</Alert>
          {revertAppointment && (<div className="bg-bg p-4 rounded-xl text-sm"><p>客戶：<b>{revertAppointment.clients?.name}</b></p><p>療程：<b>{revertAppointment.treatments?.name}</b></p></div>)}
          <div><label className="block text-sm font-medium mb-2">退回原因 (必填)</label><TextInput placeholder="例：客戶臨時取消" value={revertReason} onChange={(e) => setRevertReason(e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyAppointmentsPage;
